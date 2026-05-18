document.addEventListener('DOMContentLoaded', () => {
    // 1. Timestamp handled on submit

    // Dynamic Project Name Loading from Google Sheets (Autocomplete version)
    const projectInput = document.getElementById('project-name');
    const projectList = document.getElementById('project-list');
    const ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRQDP6IEmU3VZDvqZK2uvtmYpyKp22uTCgexR2hFI-wk_xSxSn3vrCIaigxZdgwZBUoLY-UmvUw4oVP/pub?gid=1144891342&single=true&output=csv';
    let projectSupervisorMap = {}; // Lưu trữ mapping Tên công trình -> Tên giám sát

    if (projectInput && projectList) {
        Papa.parse(ORDERS_CSV_URL, {
            download: true,
            header: false, // Dùng false để lấy theo thứ tự cột A, B, C (0, 1, 2)
            skipEmptyLines: true,
            complete: function(results) {
                // Bỏ qua dòng tiêu đề nếu có
                const data = results.data.slice(1);
                projectList.innerHTML = ''; // Clear datalist
                projectSupervisorMap = {};
                
                data.forEach(row => {
                    const colA = (row[0] || '').trim();
                    const colB = (row[1] || '').trim();
                    const colC = (row[2] || '').trim(); // Cột C: Tên giám sát
                    
                    const optionText = colA && colB ? `${colA} - ${colB}` : (colA || colB);
                    
                    if (optionText) {
                        const option = document.createElement('option');
                        option.value = optionText;
                        projectList.appendChild(option);
                        
                        if (colC) {
                            projectSupervisorMap[optionText] = colC;
                        }
                    }
                });
                projectInput.placeholder = "Gõ để tìm công trình...";
            },
            error: function(err) {
                console.error('Error fetching orders:', err);
                projectInput.placeholder = "Lỗi tải danh sách công trình";
            }
        });
    }

    // 4. Quick Select & Contractor Data Loading
    const categoryGrid = document.getElementById('category-grid');
    const categoryInput = document.getElementById('category');
    const contractorList = document.getElementById('contractor-list');
    const CONTRACTOR_DATA_URL = 'Data thau dau vao.csv';

    if (contractorList && categoryGrid) {
        Papa.parse(CONTRACTOR_DATA_URL, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                const keys = results.meta.fields || [];
                const findKey = (term) => keys.find(k => k.toLowerCase().replace(/\s/g, '').includes(term.toLowerCase().replace(/\s/g, '')));
                
                const companyKey = findKey('TÊN CÔNG TY') || 'TÊN CÔNG TY';
                const categoryKey = findKey('HẠNG MỤC') || 'HẠNG MỤC';
                
                // Populate Contractors
                const contractors = [...new Set(data.map(row => row[companyKey]).filter(Boolean))].sort();
                contractorList.innerHTML = '';
                contractors.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    contractorList.appendChild(option);
                });

                // Populate Categories
                const categories = [...new Set(data.map(row => row[categoryKey]).filter(Boolean))].sort();
                if (categories.length > 0) {
                    categoryGrid.innerHTML = '';
                    categories.forEach(cat => {
                        const chip = document.createElement('div');
                        chip.className = 'quick-chip';
                        chip.setAttribute('data-value', cat);
                        chip.textContent = cat;
                        categoryGrid.appendChild(chip);
                    });
                    setupCategoryListeners();
                } else {
                    setupCategoryListeners();
                }
            },
            error: function(err) {
                console.error('Error loading contractor data:', err);
                setupCategoryListeners();
            }
        });
    } else {
        setupCategoryListeners();
    }

    // 4.1 Tình trạng thực tế & Mức độ chậm
    const statusBtns = document.querySelectorAll('.status-btn');
    const projectStatusInput = document.getElementById('project-status');
    const delayBlock = document.getElementById('delay-block');

    statusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statusBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const status = btn.getAttribute('data-value');
            projectStatusInput.value = status;
            
            if (status === 'Chậm') {
                delayBlock.style.display = 'block';
            } else {
                delayBlock.style.display = 'none';
            }
        });
    });

    // 4.3 % Hoàn thành
    const progressSlider = document.getElementById('progress-slider');
    const progressText = document.getElementById('progress-text');
    if (progressSlider && progressText) {
        progressSlider.addEventListener('input', (e) => {
            progressText.textContent = e.target.value;
        });
    }

    // 4.4 Smart Autofill (History Progress Tracking from Google Sheets)
    const projectInputEl = document.getElementById('project-name');
    const categoryInputEl = document.getElementById('category');
    const contractorInputEl = document.getElementById('contractor');
    const supervisorInputEl = document.getElementById('supervisor');
    
    const HISTORY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1XaF_GFsPkOiudHr-G-z4B0Fjc-sl2-GcrOiiAfFdBXU/export?format=csv&gid=0';
    let globalReportHistory = [];

    // Tự động tải lịch sử từ Google Sheets khi mở app
    Papa.parse(HISTORY_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            globalReportHistory = results.data;
        }
    });

    function checkAutofillByProject() {
        const pName = projectInputEl.value;
        if (!pName) return;

        // Ưu tiên điền Tên Giám Sát từ bảng dữ liệu công trình (Cột C)
        if (projectSupervisorMap && projectSupervisorMap[pName]) {
            supervisorInputEl.value = projectSupervisorMap[pName];
        }

        if (globalReportHistory.length === 0) return;

        // Tìm kiếm báo cáo mới nhất của công trình này (Do GS ghi nhận theo thời gian, dòng cuối là mới nhất)
        const latestRow = globalReportHistory.slice().reverse().find(row => 
            (row['Công Trình'] === pName || row['Tên Công Trình'] === pName)
        );

        if (latestRow) {
            const category = latestRow['Hạng Mục'];
            const supervisor = latestRow['Giám Sát'];
            const contractor = latestRow['Nhà Thầu'];

            // Nếu Giám Sát chưa được điền từ Cột C, lấy từ lịch sử (nếu có)
            if (supervisor && !supervisorInputEl.value) supervisorInputEl.value = supervisor;
            if (contractor && !contractorInputEl.value) contractorInputEl.value = contractor;
            
            if (category && !categoryInputEl.value) {
                const chips = document.querySelectorAll('.quick-chip');
                chips.forEach(c => {
                    if (c.getAttribute('data-value') === category) {
                        chips.forEach(chip => chip.classList.remove('active'));
                        c.classList.add('active');
                        categoryInputEl.value = category;
                    }
                });
            }
            // Autofill % hoàn thành từ báo cáo gần nhất
            const oldProgress = latestRow['% Hoàn Thành'] || 0;
            if (progressSlider && progressText) {
                progressSlider.value = oldProgress;
                progressText.textContent = oldProgress;
            }

            showStatus('Đã tự động điền dữ liệu từ báo cáo gần nhất của công trình này!', 'success');
        }
    }

    projectInputEl.addEventListener('change', checkAutofillByProject);
    // Lưu ý: Category thay đổi đã được gọi trong setupCategoryListeners

    // Cập nhật setupCategoryListeners (Không gọi autofill nữa vì autofill đã chạy lúc chọn Công trình)
    function setupCategoryListeners() {
        const categoryChips = document.querySelectorAll('.quick-chip');
        categoryChips.forEach(chip => {
            chip.onclick = () => {
                categoryChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                categoryInput.value = chip.getAttribute('data-value');
            };
        });
    }

    // 5. AI Orchestration: Voice -> Text -> Extraction
    const recordBtn = document.getElementById('record-btn');
    const contentTextarea = document.getElementById('content');
    const recordingIndicator = document.getElementById('recording-indicator');
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];

    // Lấy API Key từ LocalStorage để bảo mật, nếu chưa có thì hỏi người dùng
    let OPENAI_API_KEY = localStorage.getItem('OPENAI_API_KEY') || '';

    async function checkApiKey() {
        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'null') {
            OPENAI_API_KEY = prompt("AI Orchestration cần OpenAI API Key (Hỗ trợ Whisper Medium & GPT-4o-mini). Vui lòng nhập API Key của bạn:");
            if (OPENAI_API_KEY) localStorage.setItem('OPENAI_API_KEY', OPENAI_API_KEY);
        }
    }

    async function transcribeVoice(audioFile) {
        await checkApiKey();
        if (!OPENAI_API_KEY) throw new Error("Missing API Key");

        const formData = new FormData();
        formData.append('file', audioFile);
        // Sử dụng mô hình whisper-1 của OpenAI (tương đương kiến trúc xử lý ồn cực tốt)
        formData.append('model', 'whisper-1'); 
        formData.append('prompt', 'Flexfit, phụ kiện Blum, Hafele, An Cường, Vicostone, Melamine, sơn bả, chậm tiến độ, an toàn lao động'); 

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: formData
        });

        if (!response.ok) throw new Error(`OpenAI HTTP error: ${response.status}`);
        const data = await response.json();
        return data.text;
    }

    async function extractDataWithAI(text) {
        await checkApiKey();
        const promptStr = `
Bạn là AI Orchestrator chuyên bóc tách dữ liệu công trường.
Hãy phân tích đoạn văn bản sau do giám sát viên nói và trích xuất ra JSON. Không trả về gì ngoài JSON.
Đoạn văn bản: "${text}"

Định dạng JSON yêu cầu:
{
    "projectName": "Tên công trình/dự án (nếu có, ví dụ: Vin Ocean Park, nhà anh A)",
    "contractor": "Tên nhà thầu/tổ đội (nếu có)",
    "category": "Phân loại hạng mục. Chỉ được trả về 1 trong các giá trị sau (hoặc để rỗng nếu không rõ): Gỗ, Đá, Kính, Thiết bị, Phá dỡ, Sơn bả",
    "progressPercent": "Tỷ lệ % hoàn thành (số nguyên từ 0 đến 100, để rỗng nếu không đề cập)",
    "projectStatus": "Tình trạng tiến độ. Chỉ trả về: 'Sớm hơn', 'Đúng tiến độ', hoặc 'Chậm' (để rỗng nếu không đề cập)",
    "delayLevel": "Mức độ chậm. Chỉ trả về: 'Chậm 1 ngày', 'Chậm 2 ngày', 'Chậm >2 ngày' (để rỗng nếu không đề cập)",
    "delayReasons": ["Danh sách các nguyên nhân chậm. Trả về mảng các chuỗi chính xác: 'Nhà thầu: Thiếu thợ', 'Nhà thầu: Thiếu vật tư', 'Nhà thầu: Làm sai', 'Nội bộ: Chậm hồ sơ mua', 'Nội bộ: Chậm hồ sơ SX', 'Nội bộ: Chậm triển khai', 'Khách hàng: Chưa bàn giao mặt bằng', 'Khách hàng: Phát sinh thay đổi', 'Khách quan: Thời tiết', 'Khách quan: BQL tòa nhà', 'Khách quan: Vận chuyển' (mảng rỗng nếu không đề cập)"],
    "notes": "Tóm tắt ngắn gọn nội dung báo cáo, đặc biệt lưu ý các cảnh báo lỗi, chậm tiến độ (nếu có)"
}
`;
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: promptStr }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });
        
        if (!response.ok) throw new Error('Extraction failed');
        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    }

    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            await startRecording();
        } else {
            stopRecording();
        }
    });

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.addEventListener('dataavailable', event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            });

            mediaRecorder.addEventListener('stop', async () => {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                
                let extension = 'webm';
                if (mimeType.includes('mp4')) extension = 'm4a';
                if (mimeType.includes('ogg')) extension = 'ogg';

                const audioFile = new File([audioBlob], `recording.${extension}`, { type: mimeType });
                
                // Hiển thị trạng thái đang dịch
                const originalPlaceholder = contentTextarea.placeholder;
                contentTextarea.placeholder = 'AI Whisper đang khử ồn & bóc băng...';
                recordBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                recordBtn.disabled = true;

                try {
                    // Bước 1: Voice to Text
                    const text = await transcribeVoice(audioFile);
                    if (text) {
                        contentTextarea.value += (contentTextarea.value ? ' ' : '') + text.trim();
                        
                        // Bước 2: AI Orchestration -> Extraction
                        contentTextarea.placeholder = 'AI Orchestration đang trích xuất & điền form...';
                        try {
                            const extracted = await extractDataWithAI(text);
                            
                            // Auto-fill forms based on AI extraction
                            if (extracted.projectName && !document.getElementById('project-name').value) {
                                document.getElementById('project-name').value = extracted.projectName;
                            }
                            if (extracted.contractor && !document.getElementById('contractor').value) {
                                document.getElementById('contractor').value = extracted.contractor;
                            }
                            if (extracted.category) {
                                document.getElementById('category').value = extracted.category;
                                document.querySelectorAll('#category-grid .quick-chip').forEach(c => {
                                    c.classList.remove('active');
                                    if(c.dataset.value.toLowerCase() === extracted.category.toLowerCase()) {
                                        c.classList.add('active');
                                    }
                                });
                            }
                            if (extracted.notes) {
                                document.getElementById('notes').value = extracted.notes;
                            }
                            if (extracted.progressPercent !== undefined && extracted.progressPercent !== "") {
                                const slider = document.getElementById('progress-slider');
                                const text = document.getElementById('progress-text');
                                if (slider && text) {
                                    slider.value = extracted.progressPercent;
                                    text.textContent = extracted.progressPercent;
                                }
                            }
                            if (extracted.projectStatus) {
                                document.getElementById('project-status').value = extracted.projectStatus;
                                document.querySelectorAll('.status-btn').forEach(btn => {
                                    btn.classList.remove('active');
                                    if(btn.dataset.value === extracted.projectStatus) {
                                        btn.classList.add('active');
                                    }
                                });
                                if (extracted.projectStatus === 'Chậm') {
                                    document.getElementById('delay-block').style.display = 'block';
                                    
                                    // Fill delay level
                                    if (extracted.delayLevel) {
                                        document.getElementById('delay-level').value = extracted.delayLevel;
                                    }
                                    
                                    // Fill delay reasons
                                    if (extracted.delayReasons && Array.isArray(extracted.delayReasons)) {
                                        document.querySelectorAll('input[name="delay_reason"]').forEach(cb => {
                                            cb.checked = extracted.delayReasons.includes(cb.value);
                                        });
                                    }
                                } else {
                                    document.getElementById('delay-block').style.display = 'none';
                                }
                            }
                            
                            showStatus('AI đã bóc tách & điền form thành công!', 'success');
                        } catch(extractErr) {
                            console.error('AI Extraction error:', extractErr);
                        }
                    }
                } catch (error) {
                    console.error('Transcription error:', error);
                    alert('Lỗi khi gọi AI API. Vui lòng kiểm tra lại kết nối hoặc API Key.');
                } finally {
                    contentTextarea.placeholder = originalPlaceholder;
                    recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                    recordBtn.disabled = false;
                }
            });

            mediaRecorder.start();
            isRecording = true;
            recordBtn.classList.add('recording');
            recordingIndicator.style.display = 'flex';
        } catch (error) {
            console.error('Microphone access denied:', error);
            alert('Vui lòng cấp quyền micro cho trình duyệt để sử dụng tính năng này.');
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            // Stop all audio tracks to release the mic
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordingIndicator.style.display = 'none';
    }

    // 6. Media Preview
    const mediaUpload = document.getElementById('media-upload');
    const mediaPreview = document.getElementById('media-preview');

    mediaUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        mediaPreview.innerHTML = ''; // Clear previous

        if (files.length > 20) {
            alert('Vui lòng chọn tối đa 20 file.');
            mediaUpload.value = ''; // Reset
            return;
        }

        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'media-preview-item';
                    mediaPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.className = 'media-preview-item';
                mediaPreview.appendChild(video);
            }
        });
    });

    // 7. Get GPS Location
    const getLocationBtn = document.getElementById('get-location-btn');
    const gpsInput = document.getElementById('gps-location');

    getLocationBtn.addEventListener('click', () => {
        getLocationBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lấy...';
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    gpsInput.value = `${lat}, ${lng}`;
                    getLocationBtn.innerHTML = '<i class="fa-solid fa-check text-success"></i> Đã lấy';
                    getLocationBtn.style.color = 'var(--accent-color)';
                },
                (error) => {
                    console.error("Error getting location:", error);
                    gpsInput.value = "Không thể lấy vị trí";
                    getLocationBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Thử lại';
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            gpsInput.value = "Trình duyệt không hỗ trợ GPS";
            getLocationBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Lấy GPS';
        }
    });

    // 8. Chấm điểm nhanh (Thao tác 1 chạm)
    const scoreBtns = document.querySelectorAll('.score-btn');
    const deductionBtns = document.querySelectorAll('.deduction-btn');
    const finalScoreEl = document.getElementById('final-score');
    const rankBadgeEl = document.getElementById('rank-badge');
    const deductionsListInput = document.getElementById('deductions_list');
    const deductionScoreInput = document.getElementById('deduction_score');

    function calculateFinalScore() {
        const q = parseFloat(document.getElementById('score_quality').value) || 0;
        const s = parseFloat(document.getElementById('score_schedule').value) || 0;
        const a = parseFloat(document.getElementById('score_attitude').value) || 0;
        const d = parseFloat(document.getElementById('score_discipline').value) || 0;
        
        let baseAvg = (q + s + a + d) / 4;

        let deductionTotal = 0;
        let deductionNames = [];
        deductionBtns.forEach(btn => {
            if (btn.classList.contains('active')) {
                deductionTotal += parseFloat(btn.getAttribute('data-val'));
                deductionNames.push(btn.getAttribute('data-name'));
            }
        });

        deductionsListInput.value = deductionNames.join(', ');
        deductionScoreInput.value = deductionTotal;

        let finalScore = Math.max(0, baseAvg + deductionTotal);
        finalScoreEl.textContent = finalScore.toFixed(1);

        rankBadgeEl.className = 'rank-badge'; // reset classes
        if (finalScore >= 8.5) {
            rankBadgeEl.textContent = 'LV1 (Rất Tốt)';
            rankBadgeEl.classList.add('rank-lv1');
        } else if (finalScore >= 7.0) {
            rankBadgeEl.textContent = 'LV2 (Khá/Đạt)';
            rankBadgeEl.classList.add('rank-lv2');
        } else if (finalScore >= 5.0) {
            rankBadgeEl.textContent = 'LV3 (Cải Thiện)';
            rankBadgeEl.classList.add('rank-lv3');
        } else {
            rankBadgeEl.textContent = 'CẢNH BÁO';
            rankBadgeEl.classList.add('rank-warn');
        }
    }

    scoreBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const group = e.target.closest('.btn-group');
            group.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const targetInputId = group.getAttribute('data-target');
            document.getElementById(targetInputId).value = e.target.getAttribute('data-val');
            calculateFinalScore();
        });
    });

    deductionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            calculateFinalScore();
        });
    });

    calculateFinalScore();

    // 10. Form Submission & Google Drive Integration
    const form = document.getElementById('report-form');
    const submitBtn = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');

    // Cấu hình API Google Apps Script (Sẽ tự động lưu cả Data và Ảnh vào Drive)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyZdgmh0ASmIQgGgxGIaowkQmOYTfJwMJUCTb20uTLCJ_tD71OWOkZuZ5xVr_pa0Nyr/exec';

    // Hàm nén ảnh bằng Canvas
    const compressImage = (file, maxWidth = 1280, quality = 0.7) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height *= maxWidth / width));
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxWidth) {
                            width = Math.round((width *= maxWidth / height));
                            height = maxWidth;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    }, 'image/jpeg', quality);
                };
            };
        });
    };

    // Hàm chuyển file sang Base64 để gửi cho Google
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                base64: reader.result
            });
            reader.onerror = error => reject(error);
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!categoryInput.value) {
            showStatus('Vui lòng chọn Hạng Mục Thi Công!', 'error');
            return;
        }

        const now = new Date();
        document.getElementById('timestamp').value = now.toISOString();

        const formData = new FormData(form);
        const rawData = Object.fromEntries(formData.entries());
        
        // Trích xuất các checkbox Nguyên nhân chậm vì FormData.entries() chỉ lấy giá trị cuối cùng
        const delayReasonCheckboxes = document.querySelectorAll('input[name="delay_reason"]:checked');
        const delayReasons = Array.from(delayReasonCheckboxes).map(cb => cb.value).join(', ');
        
        // Mapping dữ liệu chuẩn theo yêu cầu mới
        const data = {
            'Thời gian': rawData.timestamp,
            'Công Trình': rawData.projectName,
            'Giám Sát': rawData.supervisor,
            'Nhà Thầu': rawData.contractor,
            'Hạng Mục': rawData.category,
            'Nội dung': rawData.content,
            'GPS': rawData.gps,
            'Ghi chú': rawData.notes,
            // Các trường tiến độ mới
            'Tình Trạng': rawData.project_status,
            'Mức Độ Chậm': rawData.delay_level || '',
            'Nguyên Nhân Chậm': delayReasons,
            '% Hoàn Thành': rawData.progress_percent,
            // Điểm đánh giá nhanh
            // Điểm đánh giá nhanh
            'Chất Lượng': rawData.score_quality,
            'Tiến Độ': rawData.score_schedule,
            'Thái Độ': rawData.score_attitude,
            'Kỷ Luật': rawData.score_discipline,
            'Trừ Điểm': rawData.deduction_score,
            'Lỗi Phạt': rawData.deductions_list,
            'Tổng Điểm': document.getElementById('final-score').textContent,
            'Xếp Loại': document.getElementById('rank-badge').textContent,
            'imageFiles': [] // Sẽ chứa base64 ảnh
        };

        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu lên...';
        submitBtn.disabled = true;

        try {
            const files = Array.from(mediaUpload.files);
            if (files.length > 0) {
                // Kiểm tra tổng dung lượng file (ngăn lỗi quá tải Google Apps Script)
                const totalSize = files.reduce((acc, file) => acc + file.size, 0);
                if (totalSize > 25 * 1024 * 1024) { // Tối đa 25MB tổng
                    showStatus('Tổng dung lượng file quá lớn. Vui lòng chọn ít ảnh hơn hoặc ảnh nhẹ hơn!', 'error');
                    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> GỬI BÁO CÁO';
                    submitBtn.disabled = false;
                    return;
                }

                const processedFiles = await Promise.all(files.map(async (file) => {
                    let fileToProcess = file;
                    if (file.type.startsWith('image/')) {
                        fileToProcess = await compressImage(file);
                    } else if (file.type.startsWith('video/') && file.size > 10 * 1024 * 1024) {
                        throw new Error("Video quá lớn (Tối đa 10MB cho mỗi video).");
                    }
                    return await fileToBase64(fileToProcess);
                }));
                data.imageFiles = processedFiles;
            }

            // Gửi dữ liệu qua Google Apps Script
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu lên...';
            
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
            });
            
            // Cập nhật thông tin báo cáo vừa tạo vào globalReportHistory để lần điền kế tiếp autofill hoạt động ngay
            globalReportHistory.push({
                'Thời gian': data['Thời gian'],
                'Công Trình': data['Công Trình'],
                'Giám Sát': data['Giám Sát'],
                'Nhà Thầu': data['Nhà Thầu'],
                'Hạng Mục': data['Hạng Mục'],
                '% Hoàn Thành': data['% Hoàn Thành']
            });

            showStatus('Hiện đã cập nhật nhật báo cáo thành công, cảm ơn bạn nhó', 'success');
            form.reset();
            document.querySelectorAll('.quick-chip').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.status-btn[data-value="Đúng tiến độ"]').classList.add('active');
            document.getElementById('delay-block').style.display = 'none';
            document.getElementById('progress-text').textContent = '0';
            
            // Reset scoring UI
            document.querySelectorAll('.score-btn').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-val') === '10') b.classList.add('active');
            });
            document.querySelectorAll('.deduction-btn').forEach(b => b.classList.remove('active'));
            calculateFinalScore();

            mediaPreview.innerHTML = '';
            
        } catch (error) {
            console.error("Submission error:", error);
            showStatus(`Có lỗi: ${error.message}`, 'error');
        } finally {
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> GỬI BÁO CÁO';
            submitBtn.disabled = false;
        }
    });

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        setTimeout(() => { statusMessage.style.display = 'none'; }, 5000);
    }
});
