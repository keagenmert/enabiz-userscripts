// ==UserScript==
// @name         e-Nabız Görüntü Raporları Dışa Aktarıcı (AI-MD)
// @namespace    https://github.com/keagenmert/enabiz-userscripts
// @version      1.1.0
// @description  Radyoloji görüntü raporlarını AI-analizi için yapılandırılmış Markdown formatında indirir. Bölümleme, anonimleştirme ve sayfalama otomasyonu içerir.
// @author       Mert Amasya
// @match        https://enabiz.gov.tr/DoktorErisim/Goruntuler*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://github.com/keagenmert/enabiz-userscripts/raw/main/enabiz-goruntu-rapor-aktarici.user.js
// @downloadURL  https://github.com/keagenmert/enabiz-userscripts/raw/main/enabiz-goruntu-rapor-aktarici.user.js
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = Object.freeze({
        MASK_DIRECT_IDENTIFIERS: true,
        MAX_PAGE_ITERATIONS: 200,
        PAGE_TIMEOUT_MS: 10000,
        LOADER_TIMEOUT_MS: 20000,
        ENABLE_PROGRESS_NOTIFICATIONS: true,
        AUTO_RETRY_ON_ERROR: true,
        MAX_RETRY_ATTEMPTS: 2,
    });
    const $ = window.jQuery;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function localDateISO(date = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function oneLine(value) {
        return String(value ?? '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
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

    function normalizeSectionTitle(title) {
        const key = oneLine(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
        if (/^(BULGULAR|FINDINGS)$/.test(key)) return 'Bulgular';
        if (/^(SONUC|SONU[CÇ]|RESULT|CONCLUSION)/.test(key)) return 'Sonuç ve Öneriler';
        if (/^(KARSILASTIRMA|COMPARISON)/.test(key)) return 'Karşılaştırma';
        if (/^(IZLENIM|IMPRESSIO)/.test(key)) return 'İzlenim';
        if (/^(TEKNIK|TECHNIQUE)/.test(key)) return 'Teknik';
        if (/^(KLINIK|CLINICAL)/.test(key)) return 'Klinik Bilgi';
        return oneLine(title);
    }

    function splitReportIntoSections(reportText) {
        const lines = reportText.split('\n').map(line => line.trim()).filter(Boolean);
        const sections = [];
        let currentSection = { title: 'Genel', content: [] };

        const sectionPatterns = [
            /^(BULGULAR|SONU[CÇ]|KARSILASTIRMA|IZLENIM|TEKNIK|KLINIK|TECHNIQUE|FINDINGS|RESULT|COMPARISON|IMPRESSIO|CLINICAL):?\s*(.*)$/i,
            /^(\d+\.\s*[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s]+):?\s*(.*)$/i,
        ];

        for (const line of lines) {
            let matched = false;
            for (const pattern of sectionPatterns) {
                const match = line.match(pattern);
                if (match) {
                    if (currentSection.content.length > 0) {
                        sections.push(currentSection);
                    }
                    currentSection = { title: normalizeSectionTitle(match[1]), content: [match[2] || ''] };
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                currentSection.content.push(line);
            }
        }

        if (currentSection.content.length > 0) {
            sections.push(currentSection);
        }

        return sections;
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

    async function collectAllRows(table, onProgress) {
        const info = table.page.info();
        const all = [];
        const currentPage = Number(info.page) || 0;
        try {
            for (let page = 0; page < Math.max(Number(info.pages) || 1, 1); page += 1) {
                table.page(page).draw('page');
                await waitFor(() => Number(table.page.info().page) === page, CONFIG.PAGE_TIMEOUT_MS);
                await waitForLoader();
                const nodesApi = table.rows({ page: 'current' }).nodes();
                const nodes = typeof nodesApi.toArray === 'function' ? nodesApi.toArray() : Array.from(nodesApi || []);
                all.push(...nodes);
                onProgress?.(`Sayfa ${page + 1}/${Math.max(Number(info.pages) || 1, 1)} okunuyor — ${all.length} kayıt`);
            }
        } finally {
            table.page(currentPage).draw('page');
        }
        return all;
    }

    function downloadFile(filename, content, mime = 'text/markdown;charset=utf-8') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1000);
    }

    function makeButton(id, label, onClick, target, position = 'after') {
        if (!target || document.getElementById(id)) return;
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.className = 'btn btn-outline green btn-circle btn-xs';
        button.style.margin = '5px';
        button.textContent = label;
        button.setAttribute('aria-label', label);
        button.addEventListener('click', async () => {
            if (button.disabled) return;
            const oldText = button.textContent;
            button.disabled = true;
            button.textContent = 'Hazırlanıyor...';
            try {
                const result = await onClick((progress) => { button.textContent = progress; });
                console.log('[e-Nabız görüntü raporu dışa aktarıcı]', result);
            } catch (error) {
                console.error('[e-Nabız görüntü raporu dışa aktarıcı]', error);
                alert(`Dışa aktarma hatası: ${error.message || error}`);
            } finally {
                button.disabled = false;
                button.textContent = oldText;
            }
        });
        if (position === 'before') target.parentNode.insertBefore(button, target);
        else target.parentNode.insertBefore(button, target.nextSibling);
    }

    async function exportReports(onProgress) {
        if (!$?.fn?.DataTable) throw new Error('DataTables bulunamadı.');
        const element = document.getElementById('grdGoruntuler');
        if (!element) throw new Error('Görüntüler tablosu bulunamadı.');
        const table = $(element).DataTable();
        const rowNodes = await collectAllRows(table, onProgress);

        const reports = [];
        const patientName = patientNameFromPage();

        rowNodes.forEach(node => {
            const cells = Array.from(node.querySelectorAll('td')).map(td => oneLine(td.innerText));
            if (cells.length < 5) return;

            const date = cells[0];
            const modality = cells[1];
            const hospital = cells[2];
            const reportText = cells[4] || '';

            if (!reportText) return;

            const anonymizedText = maskClinicalIdentifiers(reportText, patientName);
            const sections = splitReportIntoSections(anonymizedText);

            reports.push({ date, modality, hospital, sections });
        });

        let markdownContent = `# e-Nabız Radyoloji Raporları\n\n`;
        markdownContent += `**Dışa Aktarma Tarihi:** ${localDateISO()}\n`;
        markdownContent += `**Toplam Rapor Sayısı:** ${reports.length}\n`;
        markdownContent += `**Kimlik Maskeleme:** ${CONFIG.MASK_DIRECT_IDENTIFIERS ? 'Aktif' : 'Kapalı'}\n\n`;
        markdownContent += `---\n\n`;

        reports.forEach((report, index) => {
            markdownContent += `## Rapor #${index + 1}\n\n`;
            markdownContent += `**Tarih:** ${report.date}  \n`;
            markdownContent += `**Modalite:** ${report.modality}  \n`;
            markdownContent += `**Kurum:** ${report.hospital}\n\n`;

            report.sections.forEach(section => {
                markdownContent += `### ${section.title}\n\n`;
                markdownContent += `${section.content.join('\n')}\n\n`;
            });

            markdownContent += `---\n\n`;
        });

        const filename = `radyoloji_raporlari_${localDateISO()}.md`;
        downloadFile(filename, markdownContent);
        return { filename, count: reports.length };
    }

    function init() {
        const path = window.location.pathname;
        if (path.includes('/Goruntuler')) {
            const target = document.querySelector('.portlet-title .caption');
            makeButton('enabizGoruntuRaporBtnV1', 'Raporları İndir (AI-MD)', exportReports, target, 'after');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();