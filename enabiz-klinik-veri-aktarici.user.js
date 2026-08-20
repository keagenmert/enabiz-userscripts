// ==UserScript==
// @name         e-Nabız Klinik Veri Dışa Aktarıcı (CSV - AI)
// @namespace    https://github.com/
// @version      4.0.0
// @description  Tahlil, epikriz, tanı ve ilaç verilerini ham alanları koruyarak klinik analiz için normalize edilmiş CSV olarak indirir.
// @author       Mert Amasya
// @match        https://enabiz.gov.tr/DoktorErisim/Tahliller*
// @match        https://enabiz.gov.tr/DoktorErisim/Epikrizler*
// @match        https://enabiz.gov.tr/DoktorErisim/Tanilar*
// @match        https://enabiz.gov.tr/DoktorErisim/Ilaclar*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = Object.freeze({
        MASK_DIRECT_IDENTIFIERS: true,
        MAX_LOAD_MORE_CLICKS: 200,
        LOADER_TIMEOUT_MS: 20000,
        PAGE_TIMEOUT_MS: 10000,
        EXCLUDE_EMPTY_EPIKRIZ_ROWS: false,
        PRESERVE_NARRATIVE_LINE_BREAKS: true,
    });

    const $ = window.jQuery;
    const path = window.location.pathname;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function currentPageName() {
        if (path.includes('/Tahliller')) return 'Tahliller';
        if (path.includes('/Epikrizler')) return 'Epikrizler';
        if (path.includes('/Tanilar')) return 'Tanilar';
        if (path.includes('/Ilaclar')) return 'Ilaclar';
        return 'Bilinmeyen';
    }

    function notifyOrchestrator(payload) {
        const message = {
            source: 'ENABIZ_EXPORTER_V4',
            type: 'ENABIZ_EXPORT_EVENT',
            page: currentPageName(),
            at: Date.now(),
            ...payload,
        };
        try { window.postMessage(message, '*'); } catch (_) { }
        try { window.dispatchEvent(new CustomEvent('ENABIZ_EXPORT_EVENT', { detail: message })); } catch (_) { }
    }

    function localDateISO(date = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function outputFilename(filename) {
        const prefix = String(window.__ENABIZ_FILENAME_PREFIX__ || '');
        return prefix && !filename.startsWith(prefix) ? `${prefix}${filename}` : filename;
    }

    function textOf(node) {
        return String(node?.innerText || node?.textContent || '').replace(/\u00a0/g, ' ').trim();
    }

    function oneLine(value) {
        return String(value ?? '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function clinicalText(value) {
        const input = String(value ?? '').replace(/\u00a0/g, ' ').replace(/\r/g, '');
        if (!CONFIG.PRESERVE_NARRATIVE_LINE_BREAKS) return oneLine(input);
        return input.split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean).join('\n').trim();
    }

    function patientNameFromPage() {
        return oneLine(document.querySelector('.dr-profile .name-box h3')?.innerText || '');
    }

    function maskClinicalIdentifiers(value, patientName) {
        let text = String(value ?? '');
        if (!CONFIG.MASK_DIRECT_IDENTIFIERS) return text;
        if (patientName && patientName.length >= 3) {
            const escaped = patientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(escaped, 'gi'), '[HASTA ADI MASKELENDİ]');
        }
        text = text.replace(/\b\d{11}\b/g, '[KİMLİK NUMARASI MASKELENDİ]');
        text = text.replace(/(Doğum Tarihi\s*[:\-]?\s*)\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/gi, '$1[DOĞUM TARİHİ MASKELENDİ]');
        return text;
    }

    function stripDiacritics(value) {
        return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function normalizedKey(value) {
        return stripDiacritics(oneLine(value).toLocaleUpperCase('tr-TR')).replace(/[^A-Z0-9]+/g, ' ').trim();
    }

    function normalizeMedicationName(value) {
        return normalizedKey(value);
    }

    function normalizeMedicationFamily(value) {
        let family = normalizedKey(value);
        family = family.replace(/\b\d+(?:[.,]\d+)?\s*(?:MG|MCG|G|ML|IU|I U)\b/g, ' ');
        family = family.replace(/\b(?:FILM|KAPLI|TABLET|KAPSUL|SURUP|JEL|EFERVESAN|ENTERIK|DEGISTIRILMIS|SALIMLI|BOLUNEBILIR|YUMUSAK|TB|GR|ADET|SUSPANSIYON|SOLUSYON)\b/g, ' ');
        family = family.replace(/\b\d+\s*(?:TABLET|TB|KAPSUL|ADET|GR)\b/g, ' ');
        family = family.replace(/\b\d+\b/g, ' ');
        return family.replace(/\s+/g, ' ').trim();
    }

    function parseNumber(value) {
        const raw = oneLine(value).replace(/\s/g, '');
        if (!raw) return '';
        if (!/^-?\d+(?:[.,]\d+)?$/.test(raw)) return '';
        return raw.replace(',', '.');
    }

    function splitDateTime(value) {
        const raw = oneLine(value);
        const match = raw.match(/^(.*?)(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/);
        return { date: match?.[1] || raw, time: match?.[2] || '' };
    }

    function toISODate(value) {
        const raw = oneLine(value);
        let match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (match) return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
        match = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
        if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
        return '';
    }

    function waitFor(predicate, timeoutMs, intervalMs = 100) {
        return new Promise(resolve => {
            const started = Date.now();
            const check = () => {
                let ok = false;
                try { ok = Boolean(predicate()); } catch (_) { ok = false; }
                if (ok) return resolve(true);
                if (Date.now() - started >= timeoutMs) return resolve(false);
                setTimeout(check, intervalMs);
            };
            check();
        });
    }

    async function waitForLoader() {
        const loader = document.getElementById('PageLoadGif');
        if (!loader) {
            await sleep(250);
            return;
        }
        await waitFor(() => {
            const style = window.getComputedStyle(loader);
            return style.display === 'none' || style.visibility === 'hidden' || loader.offsetParent === null;
        }, CONFIG.LOADER_TIMEOUT_MS, 150);
        await sleep(250);
    }

    function isVisible(node) {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && node.offsetParent !== null;
    }

    async function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = outputFilename(filename);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1000);
        return { mode: 'browser-download', detail: '' };
    }

    function csvCell(value) {
        let text = String(value ?? '').replace(/\uFEFF/g, '');
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        return `"${text.replace(/"/g, '""')}"`;
    }

    async function downloadCSV(filename, header, rows) {
        const lines = [header.map(csvCell).join(';')];
        rows.forEach(row => lines.push(header.map((_, index) => csvCell(row[index] ?? '').replace(/\uFEFF/g, '')).join(';')));
        const result = await downloadFile(filename, `\uFEFF${lines.join('\n')}`);
        return { ...result, filename };
    }

    function makeButton(id, label, onClick, target, position = 'after') {
        if (!target || document.getElementById(id)) return;
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.className = 'btn btn-outline green btn-circle btn-xs';
        button.style.margin = '5px';
        button.textContent = label;
        button.addEventListener('click', async () => {
            if (button.disabled) return;
            const oldText = button.textContent;
            button.disabled = true;
            button.textContent = 'Hazırlanıyor...';
            try {
                const result = await onClick((progress) => { button.textContent = progress; });
                notifyOrchestrator({ status: 'complete', filename: result?.filename || '', downloadMode: result?.mode || 'unknown' });
            } catch (error) {
                notifyOrchestrator({ status: 'error', error: String(error.message || error) });
                console.error('[e-Nabız klinik dışa aktarıcı]', error);
                alert(`Dışa aktarma hatası: ${error.message || error}`);
            } finally {
                button.disabled = false;
                button.textContent = oldText;
            }
        });
        if (position === 'before') target.parentNode.insertBefore(button, target);
        else target.parentNode.insertBefore(button, target.nextSibling);
    }

    async function loadMoreUntilEnd(buttonId, rowSelector, onProgress) {
        let previousCount = -1;
        let unchangedRounds = 0;
        for (let click = 0; click < CONFIG.MAX_LOAD_MORE_CLICKS; click += 1) {
            const button = document.getElementById(buttonId);
            const rowCount = document.querySelectorAll(rowSelector).length;
            if (!button || !isVisible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') break;
            if (rowCount === previousCount) unchangedRounds += 1;
            else unchangedRounds = 0;
            if (unchangedRounds >= 2) break;
            previousCount = rowCount;

            button.click();
            await waitForLoader();
            await waitFor(() => {
                const currentButton = document.getElementById(buttonId);
                const currentCount = document.querySelectorAll(rowSelector).length;
                return currentCount > rowCount || !currentButton || !isVisible(currentButton) || currentButton.disabled;
            }, CONFIG.LOADER_TIMEOUT_MS, 150);
            onProgress?.(`Ek sayfalar yükleniyor — ${document.querySelectorAll(rowSelector).length} satır`);
        }
    }

    function tableInfo(table) {
        const info = table.page.info();
        return {
            pages: Math.max(Number(info.pages) || 1, 1),
            currentPage: Number(info.page) || 0,
        };
    }

    async function collectDataTableRows(table, onProgress) {
        const info = tableInfo(table);
        const all = [];
        try {
            for (let page = 0; page < info.pages; page += 1) {
                table.page(page).draw('page');
                await waitFor(() => Number(table.page.info().page) === page, CONFIG.PAGE_TIMEOUT_MS);
                await waitForLoader();
                const nodesApi = table.rows({ page: 'current' }).nodes();
                const nodes = typeof nodesApi.toArray === 'function' ? nodesApi.toArray() : Array.from(nodesApi || []);
                all.push(...nodes);
                onProgress?.(`Sayfa ${page + 1}/${info.pages} okunuyor — ${all.length} satır`);
            }
        } finally {
            table.page(info.currentPage).draw('page');
        }
        return all;
    }

    function exactDuplicateCounts(rows) {
        const counts = new Map();
        rows.forEach(row => {
            const key = JSON.stringify(row);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return rows.map(row => counts.get(JSON.stringify(row)) || 1);
    }

    function parseReference(raw) {
        const value = oneLine(raw);
        const match = value.match(/(-?\d+(?:[.,]\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:[.,]\d+)?)/i);
        return {
            raw: value,
            lower: match ? match[1].replace(',', '.') : '',
            upper: match ? match[2].replace(',', '.') : '',
        };
    }

    function normalizeFlag(raw) {
        const value = normalizedKey(raw);
        if (!value) return '';
        if (/^(N|NORMAL)$/.test(value)) return 'Normal';
        if (/^(H|HIGH|YUKSEK)$/.test(value)) return 'Yüksek';
        if (/^(L|LOW|DUSUK)$/.test(value)) return 'Düşük';
        return oneLine(raw);
    }

    function parseResult(raw) {
        const value = oneLine(raw);
        const match = value.match(/^(<=|>=|<|>|=)?\s*(-?\d+(?:[.,]\d+)?)$/);
        return {
            raw: value,
            operator: match?.[1] || '',
            numeric: match?.[2] ? match[2].replace(',', '.') : '',
            text: match ? '' : value,
        };
    }

    function computedFlag(result, reference) {
        const numeric = Number(result?.numeric);
        const lower = reference?.lower === '' ? null : Number(reference.lower);
        const upper = reference?.upper === '' ? null : Number(reference.upper);
        if (result?.numeric === '' || Number.isNaN(numeric)) return '';
        if (lower !== null && !Number.isNaN(lower) && numeric < lower) return 'Düşük';
        if (upper !== null && !Number.isNaN(upper) && numeric > upper) return 'Yüksek';
        if ((lower !== null && !Number.isNaN(lower)) || (upper !== null && !Number.isNaN(upper))) return 'Normal';
        return '';
    }

    function extractCells(row) {
        return Array.from(row.querySelectorAll('td')).map(textOf);
    }

    function normalizeDiagnosisSection(value) {
        const key = normalizedKey(value);
        if (/^SIKAYETI?$/.test(key)) return 'Şikâyet';
        if (/^HIKAYE(?:SI)?$/.test(key)) return 'Öykü';
        if (key.startsWith('FIZIKI MUAYENE')) return 'Fizik Muayene';
        if (key.startsWith('TRIAGE')) return 'Triage';
        if (key === 'EPIKRIZ') return 'Epikriz';
        return oneLine(value);
    }

    function splitCodedDiagnoses(raw) {
        const value = oneLine(raw);
        if (!value) return [];
        const regex = /([A-ZÇĞİÖŞÜ]\d{2}(?:\.\d{1,2})?)\s*-\s*/gi;
        const matches = [];
        let match;
        while ((match = regex.exec(value)) !== null) matches.push({ code: match[1].toUpperCase(), start: match.index, bodyStart: regex.lastIndex });
        if (!matches.length) return [{ code: '', name: value }];
        return matches.map((item, index) => ({
            code: item.code,
            name: value.slice(item.bodyStart, index + 1 < matches.length ? matches[index + 1].start : value.length).replace(/\s*,\s*$/, '').trim(),
        }));
    }

    // ---------------- Tahliller ----------------
    async function exportLabs(onProgress) {
        if (!$?.fn?.DataTable) throw new Error('DataTables bulunamadı.');
        const element = document.getElementById('yetkiGrubu');
        if (!element) throw new Error('Tahlil tablosu bulunamadı.');
        const table = $(element).DataTable();
        const rowNodes = await collectDataTableRows(table, onProgress);
        const parsedRows = rowNodes
            .map(node => ({ node, cells: extractCells(node) }))
            .filter(item => item.cells.length >= 6);
        const cellsByRow = parsedRows.map(item => item.cells);
        const duplicateCounts = exactDuplicateCounts(cellsByRow);
        const groupById = new Map();
        const rowsMeta = parsedRows.map((item, index) => ({
            cells: item.cells,
            index,
            id: item.node?.getAttribute('data-tt-id') || '',
            parentId: item.node?.getAttribute('data-tt-parent-id') || '',
        }));

        rowsMeta.forEach(meta => {
            const result = oneLine(meta.cells[3]);
            if (meta.id && !meta.parentId && !result) groupById.set(meta.id, oneLine(meta.cells[2]));
        });

        const resultRows = [];
        rowsMeta.forEach((meta, index) => {
            const [dateTime, test, resultRaw, unit, referenceRaw] = [meta.cells[1], meta.cells[2], meta.cells[3], meta.cells[4], meta.cells[5]];
            const result = parseResult(resultRaw);
            if (!result.raw && meta.parentId === '') return;
            const reference = parseReference(referenceRaw);
            const group = meta.parentId ? (groupById.get(meta.parentId) || oneLine(test)) : oneLine(test);
            const date = splitDateTime(dateTime);
            resultRows.push([
                resultRows.length + 1,
                meta.index + 1,
                date.date,
                toISODate(date.date),
                date.time,
                group,
                oneLine(test),
                result.raw,
                result.numeric,
                result.operator,
                result.text,
                oneLine(unit),
                reference.raw,
                reference.lower,
                reference.upper,
                oneLine(meta.cells[6] || ''),
                normalizeFlag(meta.cells[6] || ''),
                computedFlag(result, reference),
                duplicateCounts[index],
            ]);
        });

        const header = ['Kayıt_ID', 'Kaynak_Satır_ID', 'Tarih_Ham', 'Tarih_ISO', 'Saat', 'Panel/Grup', 'Tahlil', 'Sonuç_Ham', 'Sonuç_Sayısal', 'Sonuç_Operatörü', 'Sonuç_Metinsel', 'Birim', 'Referans_Ham', 'Referans_Alt', 'Referans_Üst', 'Bayrak_Ham', 'Bayrak_Norm', 'Bayrak_Hesaplanan', 'Tam_Aynı_Kayıt_Sayısı'];
        return await downloadCSV(`tahliller_klinik_${localDateISO()}.csv`, header, resultRows);
    }

    // ---------------- Epikriz ----------------
    async function exportEpikriz(onProgress) {
        await loadMoreUntilEnd('btnLoadMoreEpikriz', '#epikrizList tr', onProgress);
        const rawRows = Array.from(document.querySelectorAll('#epikrizList tr'))
            .map(extractCells)
            .filter(cells => cells.length >= 3);
        const duplicateCounts = exactDuplicateCounts(rawRows);
        const patientName = patientNameFromPage();
        const resultRows = [];

        rawRows.forEach((cells, index) => {
            const date = splitDateTime(cells[0]);
            const title = oneLine(cells[1]);
            const description = maskClinicalIdentifiers(clinicalText(cells[2]), patientName);
            const hasContent = Boolean(description);
            if (CONFIG.EXCLUDE_EMPTY_EPIKRIZ_ROWS && !hasContent) return;
            resultRows.push([
                resultRows.length + 1,
                index + 1,
                date.date,
                toISODate(date.date),
                date.time,
                title,
                normalizeDiagnosisSection(title),
                description,
                hasContent ? 'Evet' : 'Hayır',
                CONFIG.MASK_DIRECT_IDENTIFIERS ? 'Açık' : 'Kapalı',
                duplicateCounts[index],
            ]);
        });

        const header = ['Kayıt_ID', 'Kaynak_Satır_ID', 'Tarih_Ham', 'Tarih_ISO', 'Saat', 'Başlık_Ham', 'Klinik_Bölüm_Norm', 'Açıklama_Ham', 'Klinik_İçerik_Var', 'Kimlik_Maskeleme', 'Tam_Aynı_Kayıt_Sayısı'];
        return await downloadCSV(`epikrizler_klinik_${localDateISO()}.csv`, header, resultRows);
    }

    // ---------------- Tanılar ----------------
    async function exportDiagnoses(onProgress) {
        await loadMoreUntilEnd('btnLoadMoreTani', '#taniList tr', onProgress);
        const rawRows = Array.from(document.querySelectorAll('#taniList tr'))
            .map(extractCells)
            .filter(cells => cells.length >= 7);
        const duplicateCounts = exactDuplicateCounts(rawRows);
        const roles = [
            ['Tanı', 1],
            ['Ek Tanı', 2],
            ['Ön Tanı', 3],
            ['Ayırıcı Tanı', 4],
        ];
        const resultRows = [];

        rawRows.forEach((cells, sourceIndex) => {
            let emitted = false;
            roles.forEach(([role, columnIndex]) => {
                const raw = oneLine(cells[columnIndex]);
                if (!raw) return;
                emitted = true;
                const diagnoses = splitCodedDiagnoses(raw);
                diagnoses.forEach((diagnosis, diagnosisIndex) => {
                    const diagnosisDate = splitDateTime(cells[0]);
                    resultRows.push([
                        resultRows.length + 1,
                        sourceIndex + 1,
                        diagnosisDate.date,
                        toISODate(diagnosisDate.date),
                        diagnosisDate.time,
                        role,
                        diagnosisIndex + 1,
                        diagnosis.code,
                        diagnosis.name,
                        raw,
                        oneLine(cells[5]),
                        oneLine(cells[6]),
                        duplicateCounts[sourceIndex],
                    ]);
                });
            });
            if (!emitted) {
                const date = splitDateTime(cells[0]);
                resultRows.push([resultRows.length + 1, sourceIndex + 1, date.date, toISODate(date.date), date.time, 'Belirtilmemiş', '', '', '', '', oneLine(cells[5]), oneLine(cells[6]), duplicateCounts[sourceIndex]]);
            }
        });

        const header = ['Kayıt_ID', 'Kaynak_Satır_ID', 'Tarih_Ham', 'Tarih_ISO', 'Saat', 'Tanı_Rolü', 'Tanı_Sırası', 'Tanı_Kodu', 'Tanı_Adı_Norm', 'Tanı_Ham', 'Klinik', 'Hekim', 'Tam_Aynı_Kayıt_Sayısı'];
        return await downloadCSV(`tanilar_klinik_${localDateISO()}.csv`, header, resultRows);
    }

    // ---------------- İlaçlar ----------------
    async function exportMedications(onProgress) {
        await loadMoreUntilEnd('btnLoadMoreIlac', '#ilacList tr', onProgress);
        const rawRows = Array.from(document.querySelectorAll('#ilacList tr'))
            .map(extractCells)
            .filter(cells => cells.length >= 10);
        const duplicateCounts = exactDuplicateCounts(rawRows);
        const barcodeCounts = new Map();
        const medicationNameCounts = new Map();
        const medicationFamilyCounts = new Map();
        rawRows.forEach(cells => {
            const barcode = oneLine(cells[1]);
            const medicationName = normalizeMedicationName(cells[3]);
            const medicationFamily = normalizeMedicationFamily(cells[3]);
            barcodeCounts.set(barcode, (barcodeCounts.get(barcode) || 0) + 1);
            medicationNameCounts.set(medicationName, (medicationNameCounts.get(medicationName) || 0) + 1);
            medicationFamilyCounts.set(medicationFamily, (medicationFamilyCounts.get(medicationFamily) || 0) + 1);
        });
        const resultRows = rawRows.map((cells, index) => {
            const date = splitDateTime(cells[0]);
            const dose = parseNumber(cells[4]);
            const frequency = parseNumber(cells[7]);
            const warnings = [];
            if (dose === '0' || frequency === '0') warnings.push('Sıfır doz/kullanım değeri; ham kayıt korunmuştur');
            return [
                index + 1,
                date.date,
                toISODate(date.date),
                date.time,
                oneLine(cells[1]),
                oneLine(cells[2]),
                oneLine(cells[3]),
                normalizeMedicationName(cells[3]),
                normalizeMedicationFamily(cells[3]),
                medicationNameCounts.get(normalizeMedicationName(cells[3])) || 1,
                medicationFamilyCounts.get(normalizeMedicationFamily(cells[3])) || 1,
                oneLine(cells[4]),
                dose,
                oneLine(cells[5]),
                oneLine(cells[6]),
                oneLine(cells[7]),
                frequency,
                oneLine(cells[8]),
                oneLine(cells[9]),
                barcodeCounts.get(oneLine(cells[1])) || 1,
                duplicateCounts[index],
                warnings.join('; '),
            ];
        });

        const header = ['Kayıt_ID', 'Reçete_Tarihi_Ham', 'Reçete_Tarihi_ISO', 'Reçete_Saati', 'Barkod', 'Reçete_No', 'İlaç_Adı_Ham', 'İlaç_Adı_Norm', 'İlaç_Ürün_Ailesi_Norm', 'Aynı_İlaç_Norm_Sayısı', 'Aynı_İlaç_Ailesi_Sayısı', 'Doz_Ham', 'Doz_Sayısal', 'Periyot', 'Kullanım_Şekli', 'Kullanım_Sayısı_Ham', 'Kullanım_Sayısı_Sayısal', 'Hastane', 'Branş', 'Aynı_Barkod_Sayısı', 'Tam_Aynı_Kayıt_Sayısı', 'Veri_Uyarısı'];
        return await downloadCSV(`ilaclar_klinik_${localDateISO()}.csv`, header, resultRows);
    }

    function init() {
        if (path.includes('/Tahliller')) {
            const target = document.getElementById('btnIsletmeSonuclariGoruntule');
            makeButton('enabizKlinikTahlilBtnV4', 'CSV İndir (Klinik)', exportLabs, target, 'before');
        } else if (path.includes('/Epikrizler')) {
            const target = document.querySelector('.portlet-title .caption');
            makeButton('enabizKlinikEpikrizBtnV4', 'CSV İndir (Klinik)', exportEpikriz, target, 'after');
        } else if (path.includes('/Tanilar')) {
            const target = document.querySelector('.portlet-title .caption');
            makeButton('enabizKlinikTaniBtnV4', 'CSV İndir (Klinik)', exportDiagnoses, target, 'after');
        } else if (path.includes('/Ilaclar')) {
            const target = document.querySelector('.PortletBox');
            if (!target) return;
            const wrapper = document.createElement('div');
            wrapper.id = 'enabizKlinikIlacWrapperV4';
            wrapper.style.padding = '10px';
            wrapper.style.textAlign = 'right';
            target.insertBefore(wrapper, target.firstChild);
            makeButton('enabizKlinikIlacBtnV4', 'CSV İndir (Klinik)', exportMedications, wrapper, 'after');
        }
    }

    init();
})();