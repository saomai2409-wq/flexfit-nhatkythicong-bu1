document.addEventListener('DOMContentLoaded', () => {
    // URL CSV Google Sheets từ người dùng cung cấp (Sheet mới)
    const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1XaF_GFsPkOiudHr-G-z4B0Fjc-sl2-GcrOiiAfFdBXU/export?format=csv&gid=0';

    const loadingOverlay = document.getElementById('loading');
    const refreshBtn = document.getElementById('refresh-btn');
    const showReportsBtn = document.getElementById('show-reports-btn');
    const showContractorsBtn = document.getElementById('show-contractors-btn');
    const dashboardView = document.getElementById('dashboard-view');
    const contractorsView = document.getElementById('contractors-view');
    const contractorTableBody = document.getElementById('contractor-table-body');
    const contractorSearch = document.getElementById('contractor-search');
    
    let categoryChartInstance = null;
    let timelineChartInstance = null;
    let allContractors = [];
    let cachedData = []; // Store raw report data for filtering

    // Khởi tạo Dashboard
    fetchData();
    fetchContractors();

    showReportsBtn.addEventListener('click', () => {
        showReportsBtn.classList.add('active');
        showContractorsBtn.classList.remove('active');
        dashboardView.style.display = 'block';
        contractorsView.style.display = 'none';
    });

    showContractorsBtn.addEventListener('click', () => {
        showContractorsBtn.classList.add('active');
        showReportsBtn.classList.remove('active');
        dashboardView.style.display = 'none';
        contractorsView.style.display = 'block';
    });

    refreshBtn.addEventListener('click', () => {
        fetchData();
        fetchContractors();
    });

    const projectFilter = document.getElementById('project-filter');
    const resetFilterBtn = document.getElementById('reset-filter-btn');

    projectFilter.addEventListener('change', (e) => {
        const selectedProject = e.target.value;
        const detailView = document.getElementById('project-details-view');
        const detailTitle = document.getElementById('project-detail-title');
        const detailBody = document.getElementById('project-detail-body');

        if (selectedProject) {
            detailView.style.display = 'block';
            detailTitle.textContent = `Chi Tiết Công Trình: ${selectedProject}`;
            detailBody.innerHTML = '';

            const filtered = cachedData.filter(row => {
                const pName = row['Công Trình'] || row['Tên Công Trình'] || row['projectName'] || '';
                return pName === selectedProject;
            });
            
            let cats = {};
            filtered.forEach(row => {
                const cat = row['Hạng Mục'] || 'Chung';
                cats[cat] = {
                    contractor: row['Nhà Thầu'] || 'Không rõ',
                    supervisor: row['Giám Sát'] || 'Vô danh',
                    progress: parseFloat(row['% Hoàn Thành']) || 0,
                    status: row['Tình Trạng'] || (parseFloat(row['Tiến Độ'] || row['TĐ_Đúng hạn'] || 0) >= 7 ? 'Đúng tiến độ' : 'Chậm')
                };
            });
            
            Object.keys(cats).forEach(cat => {
                let data = cats[cat];
                let statusStyle = data.status === 'Chậm' ? 'background: rgba(239, 68, 68, 0.2); color: #ef4444;' : 
                                  data.status === 'Sớm hơn' ? 'background: rgba(139, 92, 246, 0.2); color: #8b5cf6;' : 
                                  'background: rgba(16, 185, 129, 0.2); color: #10b981;';
                detailBody.innerHTML += `
                    <tr>
                        <td><strong>${cat}</strong></td>
                        <td>${data.contractor}</td>
                        <td>${data.supervisor}</td>
                        <td style="text-align: center;">
                            <div style="background: rgba(255,255,255,0.1); border-radius: 10px; height: 8px; width: 100%; margin-top: 5px;">
                                <div style="background: #3b82f6; height: 100%; border-radius: 10px; width: ${data.progress}%;"></div>
                            </div>
                            <small>${data.progress}%</small>
                        </td>
                        <td style="text-align: right;"><span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; ${statusStyle}">${data.status}</span></td>
                    </tr>
                `;
            });

            processData(filtered);
        } else {
            detailView.style.display = 'none';
            processData(cachedData);
        }
    });

    resetFilterBtn.addEventListener('click', () => {
        projectFilter.value = '';
        document.getElementById('project-details-view').style.display = 'none';
        processData(cachedData);
    });

    function populateProjectFilter(data) {
        const pNames = [...new Set(data.map(row => 
            row['Công Trình'] || row['Tên Công Trình'] || row['projectName'] || 'Không rõ'
        ))].filter(n => n !== 'Không rõ').sort();
        
        projectFilter.innerHTML = '<option value="">-- Tất cả công trình (Tổng quan) --</option>';
        pNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            projectFilter.appendChild(opt);
        });
    }

    contractorSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allContractors.filter(c => 
            c.name.toLowerCase().includes(term) || 
            c.category.toLowerCase().includes(term) ||
            c.contact.toLowerCase().includes(term)
        );
        renderContractors(filtered);
    });

    function fetchContractors() {
        Papa.parse('Data thau dau vao.csv', {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                // Map data to clean object structure
                const keys = results.meta.fields || [];
                const findKey = (term) => keys.find(k => k.toLowerCase().replace(/\s/g, '').includes(term.toLowerCase().replace(/\s/g, '')));
                
                const kcsKey = findKey('KCS');
                const phoneKey = findKey('ĐIỆN THOẠI');
                const companyKey = findKey('TÊN CÔNG TY') || 'TÊN CÔNG TY';
                const contactKey = findKey('NGƯỜI LIÊN HỆ') || 'NGƯỜI LIÊN HỆ';
                const statusKey = findKey('TRẠNG THÁI') || 'TRẠNG THÁI';
                const categoryKey = findKey('HẠNG MỤC') || 'HẠNG MỤC';

                allContractors = results.data.map(row => ({
                    name: row[companyKey] || '',
                    contact: row[contactKey] || '',
                    phone: row[phoneKey] || '',
                    status: row[statusKey] || '',
                    category: row[categoryKey] || '',
                    kcs: row[kcsKey] || '0'
                })).filter(c => c.name);

                renderContractors(allContractors);
            }
        });
    }

    function renderContractors(data) {
        contractorTableBody.innerHTML = '';
        data.forEach(c => {
            const tr = document.createElement('tr');
            
            // Score color logic
            let scoreColor = '#94a3b8';
            const score = parseFloat(c.kcs);
            if (score >= 25) scoreColor = '#10b981';
            else if (score >= 20) scoreColor = '#3b82f6';
            else if (score > 0) scoreColor = '#f59e0b';

            // Status badge logic
            const statusClass = c.status === 'ACTIVE' ? 'status-success' : 'status-error';
            const statusStyle = c.status === 'ACTIVE' ? 'background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);' : 'background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);';

            tr.innerHTML = `
                <td><strong>${c.name}</strong></td>
                <td><span style="background: rgba(147, 51, 234, 0.1); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${c.category}</span></td>
                <td>${c.contact}</td>
                <td>${c.phone}</td>
                <td><span style="font-weight: 800; color: ${scoreColor};">${c.kcs}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; ${statusStyle}">${c.status}</span></td>
            `;
            contractorTableBody.appendChild(tr);
        });
    }

    function fetchData() {
        loadingOverlay.style.display = 'flex';
        
        Papa.parse(GOOGLE_SHEETS_CSV_URL, {
            download: true,
            header: true,
            complete: function(results) {
                const data = results.data.filter(row => row['Timestamp'] || row['timestamp'] || row['Thời gian'] || row['Tên Công Trình'] || row['projectName'] || row['Công Trình']); // Lọc dòng trống
                cachedData = data;
                populateProjectFilter(data);
                processData(data);
                loadingOverlay.style.display = 'none';
            },
            error: function(error) {
                console.error("Lỗi khi tải dữ liệu:", error);
                if (window.location.protocol === 'file:') {
                    alert("LỖI TRÌNH DUYỆT: Bạn đang mở file trực tiếp từ máy tính (file:///...). Cốc Cốc/Chrome sẽ chặn tải dữ liệu vì lý do bảo mật. Vui lòng tải file zip lên Netlify để xem Dashboard hoạt động bình thường!");
                } else {
                    alert("Không thể tải dữ liệu từ Google Sheets. Vui lòng kiểm tra lại Link Public CSV.");
                }
                loadingOverlay.style.display = 'none';
            }
        });
    }

    let trendChartInstance = null;
    let errorTrendChartInstance = null;
    let kcsRadarChartInstance = null;
    let errorPieChartInstance = null;

    function processData(data) {
        let totalReports = data.length;
        if(totalReports === 0) return;

        let onTimeCount = 0;
        let totalErrors = 0;
        let totalScoreSum = 0;
        let validScores = 0;

        let projects = {};
        let contractors = {};
        let dateStats = {};
        let supervisors = {};
        let delayReasonsCount = {};
        let progressStats = {};
        let workItems = {};

        data.forEach(row => {
            const pName = row['Công Trình'] || row['Tên Công Trình'] || 'Không rõ';
            const cName = row['Nhà Thầu'] || 'Không rõ';
            const sName = row['Giám Sát'] || 'Vô danh';
            const timestamp = row['Thời gian'] || row['Timestamp'] || '';
            const dateStr = timestamp ? new Date(timestamp).toLocaleDateString('vi-VN') : 'Unknown';

            // Hỗ trợ cả format cũ và mới
            const tdScore = parseFloat(row['Tiến Độ'] || row['TĐ_Đúng hạn'] || 0);
            const clScore = parseFloat(row['Chất Lượng'] || row['CL_Hoàn thiện'] || 0);
            const atScore = parseFloat(row['Thái Độ'] || row['AT_Hợp tác'] || 0);
            const klScore = parseFloat(row['Kỷ Luật'] || row['KL_An toàn'] || 0);
            const finalScore = parseFloat(row['Tổng Điểm']) || ((tdScore + clScore + atScore + klScore)/4) || 0;
            const errors = (row['Lỗi Phạt'] || '').split(',').filter(e => e.trim() !== '');

            const projectStatus = row['Tình Trạng'] || '';
            const delayReasonStr = row['Nguyên Nhân Chậm'] || '';
            const progressPercent = parseFloat(row['% Hoàn Thành']) || 0;

            // Check Tiến độ
            let isOnTime = true;
            if (projectStatus === 'Chậm' || tdScore < 7 || errors.some(e => e.toLowerCase().includes('chậm'))) {
                isOnTime = false;
            }
            if (isOnTime) onTimeCount++;

            // Track Delay Reasons
            if (!isOnTime && delayReasonStr) {
                delayReasonStr.split(',').forEach(r => {
                    let rClean = r.trim();
                    if (rClean) delayReasonsCount[rClean] = (delayReasonsCount[rClean] || 0) + 1;
                });
            }

            // Track Progress By Project over time
            if (dateStr !== 'Unknown' && pName !== 'Không rõ') {
                if (!progressStats[dateStr]) progressStats[dateStr] = { maxProgress: 0 };
                // Giả lập lấy tiến độ cao nhất trong ngày để vẽ biểu đồ
                if (progressPercent > progressStats[dateStr].maxProgress) {
                    progressStats[dateStr].maxProgress = progressPercent;
                }
            }
            
            totalErrors += errors.length;

            if (finalScore > 0) {
                totalScoreSum += finalScore;
                validScores++;
            }

            // Group by Project
            if (pName !== 'Không rõ') {
                if (!projects[pName]) projects[pName] = { scoreSum: 0, count: 0, errors: 0, delayed: 0, categories: {} };
                projects[pName].scoreSum += finalScore;
                projects[pName].count++;
                projects[pName].errors += errors.length;
                if (!isOnTime) projects[pName].delayed++;
                
                const category = row['Hạng Mục'] || 'Khác';
                if (!projects[pName].categories[category]) {
                    projects[pName].categories[category] = { progress: 0, contractor: cName, supervisor: sName, status: projectStatus || (isOnTime ? 'Đúng tiến độ' : 'Chậm') };
                }
                projects[pName].categories[category].progress = progressPercent;
                projects[pName].categories[category].contractor = cName;
                projects[pName].categories[category].supervisor = sName;
                projects[pName].categories[category].status = projectStatus || (isOnTime ? 'Đúng tiến độ' : 'Chậm');
            }

            // Group by Contractor
            if (cName !== 'Không rõ') {
                if (!contractors[cName]) contractors[cName] = { 
                    cl: 0, td: 0, at: 0, kl: 0, final: 0, count: 0, errorCounts: {} 
                };
                let c = contractors[cName];
                c.cl += clScore; c.td += tdScore; c.at += atScore; c.kl += klScore; c.final += finalScore;
                c.count++;
                errors.forEach(err => {
                    let eName = err.trim();
                    if(eName) c.errorCounts[eName] = (c.errorCounts[eName] || 0) + 1;
                });
            }

            // Group by Date for Trends
            if (dateStr !== 'Unknown') {
                if (!dateStats[dateStr]) dateStats[dateStr] = { cl: 0, td: 0, errs: 0, count: 0 };
                dateStats[dateStr].cl += clScore;
                dateStats[dateStr].td += tdScore;
                dateStats[dateStr].errs += errors.length;
                dateStats[dateStr].count++;
            }

            // Group by Supervisor
            if (sName !== 'Vô danh') {
                if (!supervisors[sName]) supervisors[sName] = { count: 0, projects: new Set(), errorsFound: 0, projectDetails: {} };
                supervisors[sName].count++;
                supervisors[sName].errorsFound += errors.length;
                if (pName !== 'Không rõ') {
                    supervisors[sName].projects.add(pName);
                    if (!supervisors[sName].projectDetails[pName]) {
                        supervisors[sName].projectDetails[pName] = { reports: 0, tdScoreSum: 0, kcsScoreSum: 0, errors: 0, delayed: false };
                    }
                    let pDetail = supervisors[sName].projectDetails[pName];
                    pDetail.reports++;
                    pDetail.tdScoreSum += tdScore;
                    pDetail.kcsScoreSum += finalScore;
                    pDetail.errors += errors.length;
                    if (!isOnTime) pDetail.delayed = true;
                }
            }

            // Track History for Stagnation Detection
            const catName = row['Hạng Mục'] || 'Chung';
            const itemKey = `${pName} - ${catName}`;
            if (pName !== 'Không rõ') {
                if (!workItems[itemKey]) workItems[itemKey] = [];
                workItems[itemKey].push({
                    date: timestamp ? new Date(timestamp) : new Date(),
                    progress: progressPercent,
                    status: projectStatus
                });
            }
        });

        // 1. Update KPIs
        let onTimePct = totalReports > 0 ? ((onTimeCount / totalReports) * 100).toFixed(1) : 0;
        document.getElementById('kpi-ontime').textContent = onTimePct + '%';
        document.getElementById('kpi-delayed').textContent = (100 - parseFloat(onTimePct)).toFixed(1) + '%';
        document.getElementById('kpi-errors').textContent = totalErrors;
        document.getElementById('avg-kcs').textContent = validScores ? (totalScoreSum/validScores).toFixed(1) : '0.0';

        // 2. Project Highlights & SOS Logic
        let bestProject = '-', riskProject = '-';
        let maxScore = -1, maxErrors = -1;
        
        let runningCount = 0;
        let completedCount = 0;
        let delayedProjCount = 0;
        let sosCount = 0;
        let sosList = []; // Array of SOS project names

        Object.keys(projects).forEach(p => {
            let d = projects[p];
            let avg = d.scoreSum / d.count;
            if (avg > maxScore) { maxScore = avg; bestProject = p; }
            if (d.errors > maxErrors) { maxErrors = d.errors; riskProject = p; }
            
            // Tính toán SOS & Trạng thái Công trình
            let cats = Object.values(d.categories);
            let isCompleted = cats.length > 0 && cats.every(c => c.progress === 100);
            let isDelayed = d.delayed > 0 || cats.some(c => c.status === 'Chậm');
            // Công trình SOS: Có > 3 lần báo chậm hoặc có > 3 lỗi phạt
            let isSOS = d.delayed >= 3 || d.errors >= 3;

            runningCount++;
            if (isCompleted) completedCount++;
            if (isDelayed) delayedProjCount++;
            if (isSOS) {
                sosCount++;
                sosList.push(p);
            }
        });
        
        if (document.getElementById('kpi-running')) document.getElementById('kpi-running').textContent = runningCount;
        if (document.getElementById('kpi-completed')) document.getElementById('kpi-completed').textContent = completedCount;
        if (document.getElementById('kpi-delayed-projects')) document.getElementById('kpi-delayed-projects').textContent = delayedProjCount;
        if (document.getElementById('kpi-sos')) document.getElementById('kpi-sos').textContent = sosCount;

        document.getElementById('best-project').textContent = bestProject;
        document.getElementById('risk-project').textContent = riskProject;
        document.getElementById('delayed-project').textContent = sosCount > 0 ? sosList.slice(0, 2).join(', ') + (sosCount > 2 ? '...' : '') : '-';

        // 3. Contractor Highlights & Select Populate
        let topContractor = '-', bottomContractor = '-';
        let cMaxScore = -1, cMinScore = 999;
        const contractorSelect = document.getElementById('contractor-select');
        contractorSelect.innerHTML = '<option value="">-- Chọn Nhà Thầu (Xem chi tiết) --</option>';

        Object.keys(contractors).forEach(c => {
            let d = contractors[c];
            let avg = d.final / d.count;
            if (avg > cMaxScore) { cMaxScore = avg; topContractor = c; }
            if (avg < cMinScore && d.count > 0) { cMinScore = avg; bottomContractor = c; }
            
            let opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            contractorSelect.appendChild(opt);
        });
        document.getElementById('top-contractor').textContent = topContractor;
        document.getElementById('bottom-contractor').textContent = bottomContractor;

        // Xử lý khi chọn Nhà Thầu
        contractorSelect.addEventListener('change', (e) => {
            if(e.target.value) renderContractorDeepDive(e.target.value, contractors);
            else document.getElementById('contractor-deep-dive').style.display = 'none';
        });

        // 3.5 Supervisor Highlights
        let bestSupervisor = '-';
        let maxReports = -1;
        const supervisorBody = document.getElementById('supervisor-highlights');
        supervisorBody.innerHTML = '';

        const sortedSupervisors = Object.keys(supervisors).sort((a, b) => supervisors[b].count - supervisors[a].count);
        
        sortedSupervisors.slice(0, 4).forEach(s => {
            let d = supervisors[s];
            if (d.count > maxReports) { maxReports = d.count; bestSupervisor = s; }
            
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s}</strong></td>
                <td style="text-align: right;">${d.projects.size}</td>
                <td style="text-align: right;"><span class="badge-avg" style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; font-size: 0.8rem; border-radius: 4px;">${d.count}</span></td>
            `;
            supervisorBody.appendChild(tr);
        });
        document.getElementById('best-supervisor').textContent = bestSupervisor;

        // 3.6 Supervisor Select Dropdown Populate
        const supervisorSelect = document.getElementById('supervisor-select');
        supervisorSelect.innerHTML = '<option value="">-- Chọn Giám Sát (Xem chi tiết) --</option>';

        sortedSupervisors.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            supervisorSelect.appendChild(opt);
        });
        
        supervisorSelect.addEventListener('change', (e) => {
        if(e.target.value) renderSupervisorDeepDive(e.target.value, supervisors);
            else document.getElementById('supervisor-deep-dive').style.display = 'none';
        });

        // 3.7 Detect Stagnant WorkItems (2 days no progress or 2x Delay)
        let stagnantItems = [];
        Object.keys(workItems).forEach(key => {
            // Sort by date
            const history = workItems[key].sort((a,b) => a.date - b.date);
            if (history.length >= 2) {
                const last = history[history.length - 1];
                const prev = history[history.length - 2];
                
                // If progress hasn't moved and it's not finished
                if (last.progress <= prev.progress && last.progress < 100) {
                    stagnantItems.push({ name: key, progress: last.progress, reason: 'Tiến độ dậm chân tại chỗ' });
                } else if (last.status === 'Chậm' && prev.status === 'Chậm') {
                    stagnantItems.push({ name: key, progress: last.progress, reason: 'Liên tục báo Chậm' });
                }
            }
        });

        // 4. Sinh AI Insights
        generateAIInsights(topContractor, bottomContractor, riskProject, totalErrors, onTimePct, delayReasonsCount, sosCount, sosList, stagnantItems);

        // 5. Vẽ biểu đồ Trend
        drawTrendCharts(dateStats);
        
        // 6. Vẽ biểu đồ Tiến Độ & Delay
        drawProgressTimelineChart(progressStats);
        drawDelayReasonChart(delayReasonsCount);
    }

    function generateAIInsights(topC, bottomC, riskP, errs, onTimePct, delayReasonsCount, sosCount, sosList, stagnantItems) {
        const list = document.getElementById('ai-insights-list');
        list.innerHTML = '';
        const insights = [];
        
        if (sosCount > 0) {
            insights.push(`KHẨN CẤP (SOS): Đang có <strong style="color: #ef4444;">${sosCount} công trình</strong> cần ban giám đốc tập trung xử lý ngay lập tức (Bao gồm: ${sosList.slice(0,3).join(', ')}).`);
        }
        
        // 1. Cảnh báo dậm chân tại chỗ (Stagnation)
        if (stagnantItems && stagnantItems.length > 0) {
            stagnantItems.slice(0, 3).forEach(item => {
                insights.push(`<strong style="color: #ef4444;">BÁO ĐỘNG:</strong> <span style="color: white;">${item.name}</span> (${item.progress}%) - <span style="color: #f59e0b;">${item.reason}</span>. Cần can thiệp ngay!`);
            });
        }

        if (parseFloat(onTimePct) < 80) {
            insights.push(`CẢNH BÁO: Tỷ lệ đúng tiến độ hệ thống thấp (${onTimePct}%). Yêu cầu đốc thúc các hạng mục chậm.`);
        } else {
            insights.push(`TÍCH CỰC: Tỷ lệ đúng tiến độ đạt mức ổn định (${onTimePct}%).`);
        }

        if (bottomC !== '-') insights.push(`CHÚ Ý: Nhà thầu <strong style="color: #ef4444;">${bottomC}</strong> có điểm thấp nhất. Cần nhắc nhở & tăng cường giám sát.`);
        if (riskP !== '-') insights.push(`RỦI RO: Công trình <strong style="color: #f59e0b;">${riskP}</strong> phát sinh nhiều lỗi/báo chậm. Yêu cầu QA/QC kiểm tra.`);
        
        // Phân tích lý do chậm trễ nhiều nhất
        let topDelayReason = '';
        let maxReasonCount = 0;
        Object.keys(delayReasonsCount).forEach(r => {
            if (delayReasonsCount[r] > maxReasonCount) {
                maxReasonCount = delayReasonsCount[r];
                topDelayReason = r;
            }
        });

        if (topDelayReason) {
            insights.push(`ĐIỂM NÓNG: Lý do chậm nhiều nhất: <strong style="color: #ef4444;">${topDelayReason}</strong> (${maxReasonCount} vụ).`);
        }

        insights.forEach(text => {
            let li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-caret-right" style="color: var(--primary-color);"></i> ${text}`;
            list.appendChild(li);
        });
    }

    function drawTrendCharts(dateStats) {
        const sortedDates = Object.keys(dateStats).sort((a, b) => {
            const [d1, m1, y1] = a.split('/');
            const [d2, m2, y2] = b.split('/');
            return new Date(y1, m1-1, d1) - new Date(y2, m2-1, d2);
        }).slice(-14); // Lấy 14 ngày gần nhất

        if (sortedDates.length === 0) return;

        const clData = sortedDates.map(d => (dateStats[d].cl / dateStats[d].count).toFixed(1));
        const tdData = sortedDates.map(d => (dateStats[d].td / dateStats[d].count).toFixed(1));
        const errData = sortedDates.map(d => dateStats[d].errs);

        // Biểu đồ Line (Hiệu Suất)
        const ctxTrend = document.getElementById('trendChart').getContext('2d');
        if (trendChartInstance) trendChartInstance.destroy();
        trendChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: sortedDates.map(d => d.slice(0,5)), // Chỉ hiện DD/MM
                datasets: [
                    { label: 'Chất lượng', data: clData, borderColor: '#3b82f6', tension: 0.3 },
                    { label: 'Tiến độ', data: tdData, borderColor: '#10b981', tension: 0.3 }
                ]
            },
            options: {
                plugins: { legend: { labels: { color: '#f8fafc' } } },
                scales: {
                    y: { max: 10, min: 0, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });

        // Biểu đồ Area/Bar (Lỗi)
        const ctxErr = document.getElementById('errorTrendChart').getContext('2d');
        if (errorTrendChartInstance) errorTrendChartInstance.destroy();
        errorTrendChartInstance = new Chart(ctxErr, {
            type: 'bar',
            data: {
                labels: sortedDates.map(d => d.slice(0,5)),
                datasets: [{
                    label: 'Số lỗi phát sinh',
                    data: errData,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderRadius: 4
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });
    }

    function renderContractorDeepDive(name, contractors) {
        document.getElementById('contractor-deep-dive').style.display = 'grid';
        let d = contractors[name];
        let count = d.count || 1;
        
        // Radar Chart
        const radarData = [d.cl/count, d.td/count, d.at/count, d.kl/count];
        const ctxRadar = document.getElementById('kcsRadarChart').getContext('2d');
        if (kcsRadarChartInstance) kcsRadarChartInstance.destroy();
        kcsRadarChartInstance = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['Chất lượng', 'Tiến độ', 'Thái độ', 'Kỷ luật'],
                datasets: [{
                    label: name,
                    data: radarData,
                    backgroundColor: 'rgba(147, 51, 234, 0.2)',
                    borderColor: '#c084fc',
                    pointBackgroundColor: '#c084fc',
                    borderWidth: 2
                }]
            },
            options: {
                scales: { r: { max: 10, min: 0, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#f8fafc' } } },
                plugins: { legend: { display: false } }
            }
        });

        // Pie Chart
        const ctxPie = document.getElementById('errorPieChart').getContext('2d');
        if (errorPieChartInstance) errorPieChartInstance.destroy();
        
        const errLabels = Object.keys(d.errorCounts);
        const errValues = Object.values(d.errorCounts);
        
        if (errLabels.length === 0) {
            // Không có lỗi
            errLabels.push('Không có lỗi');
            errValues.push(1);
        }

        errorPieChartInstance = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: errLabels,
                datasets: [{
                    data: errValues,
                    backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7'],
                    borderWidth: 0
                }]
            },
            options: {
                plugins: { 
                    legend: { position: 'bottom', labels: { color: '#f8fafc', font: {size: 10} } }
                },
                cutout: '60%'
            }
        });
    }

    function renderSupervisorDeepDive(name, supervisors) {
        document.getElementById('supervisor-deep-dive').style.display = 'block';
        let d = supervisors[name];
        
        document.getElementById('sup-total-reports').textContent = d.count;
        document.getElementById('sup-total-projects').textContent = d.projects.size;
        document.getElementById('sup-total-errors').textContent = d.errorsFound;
        
        const tbody = document.getElementById('sup-projects-list');
        tbody.innerHTML = '';
        Object.keys(d.projectDetails).sort((a,b) => d.projectDetails[b].reports - d.projectDetails[a].reports).forEach(p => {
            let pd = d.projectDetails[p];
            let avgKCS = (pd.kcsScoreSum / pd.reports).toFixed(1);
            let statusHTML = pd.delayed ? '<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Chậm</span>' : '<span style="color: #10b981;"><i class="fa-solid fa-check"></i> Ổn định</span>';
            let kcsColor = avgKCS >= 8 ? '#10b981' : (avgKCS >= 6 ? '#f59e0b' : '#ef4444');

            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p}</strong></td>
                <td style="text-align: center;"><span class="badge-avg" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 6px; font-size: 0.8rem; border-radius: 4px;">${pd.reports}</span></td>
                <td style="text-align: center; font-size: 0.85rem;">${statusHTML}</td>
                <td style="text-align: center; color: #ef4444; font-weight: bold;">${pd.errors > 0 ? pd.errors : '-'}</td>
                <td style="text-align: right; color: ${kcsColor}; font-weight: bold;">${avgKCS}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    let progressTimelineChartObj = null;
    function drawProgressTimelineChart(progressStats) {
        const ctx = document.getElementById('progressTimelineChart');
        if(!ctx) return;
        if(progressTimelineChartObj) progressTimelineChartObj.destroy();

        const labels = Object.keys(progressStats).sort((a, b) => {
            let [d1,m1,y1] = a.split('/'); let [d2,m2,y2] = b.split('/');
            return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
        }).slice(-14);

        const dataArr = labels.map(l => progressStats[l].maxProgress);

        progressTimelineChartObj = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels.map(d => d.slice(0,5)),
                datasets: [{
                    label: '% Hoàn Thành',
                    data: dataArr,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    let delayReasonChartObj = null;
    function drawDelayReasonChart(delayReasonsCount) {
        const ctx = document.getElementById('delayReasonChart');
        if(!ctx) return;
        if(delayReasonChartObj) delayReasonChartObj.destroy();

        const sortedReasons = Object.entries(delayReasonsCount)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5);

        if (sortedReasons.length === 0) return;

        delayReasonChartObj = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedReasons.map(r => r[0]),
                datasets: [{
                    label: 'Số vụ',
                    data: sortedReasons.map(r => r[1]),
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8', font: {size: 10} }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
});
