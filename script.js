// story_voice_tts/frontend/script.js
document.addEventListener('DOMContentLoaded', function() {
    // 语音合成对象
    const synth = window.speechSynthesis;
    let voices = [];
    let utterance = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isPlaying = false;
    let lastSelectedVoiceName = null;
    
    // DOM元素
    const storyTitle = document.getElementById('storyTitle');
    const storyText = document.getElementById('storyText');
    const voiceSelect = document.getElementById('voiceSelect');
    const ieltsPartSelect = document.getElementById('ieltsPartSelect');
    const ieltsLevelSelect = document.getElementById('ieltsLevelSelect');
    const generateQuestionBtn = document.getElementById('generateQuestionBtn');
    const rateRange = document.getElementById('rateRange');
    const rateValue = document.getElementById('rateValue');
    // const pitchRange = document.getElementById('pitchRange'); // Commented out
    // const pitchValue = document.getElementById('pitchValue'); // Commented out
    const exportFormat = document.getElementById('exportFormat');
    const previewBtn = document.getElementById('previewBtn');
    const exportBtn = document.getElementById('exportBtn');
    const stopBtn = document.getElementById('stopBtn');
    const audioPreview = document.getElementById('audioPreview');
    const audioPreviewContainer = document.getElementById('audioPreviewContainer');
    const statusMessage = document.getElementById('statusMessage');
    
    // DeepSeek API Configuration
    const API_KEY = 'sk-e0819703cff243a1881edad705d82ac2';
    const API_URL = 'https://api.deepseek.com/v1/chat/completions';
    const MODEL_NAME = 'deepseek-reasoner';
    
    // 初始化语音列表
    function loadVoices() {
        voices = synth.getVoices();
        const previouslySelectedVoiceName = lastSelectedVoiceName;
        voiceSelect.innerHTML = '';
        
        // 过滤中文和英语语音
        const filteredVoices = voices.filter(voice => 
            voice.lang.includes('zh') || voice.lang.includes('en')
        );
        
        if (filteredVoices.length === 0) {
            const option = document.createElement('option');
            option.textContent = '未找到可用语音，请检查浏览器设置';
            voiceSelect.appendChild(option);
            lastSelectedVoiceName = null;
        } else {
            filteredVoices.forEach(voice => {
                const option = document.createElement('option');
                option.textContent = `${voice.name} (${voice.lang})`;
                option.setAttribute('data-name', voice.name);
                option.setAttribute('data-lang', voice.lang);
                voiceSelect.appendChild(option);
            });

            let foundAndRestored = false;
            if (previouslySelectedVoiceName) {
                for (let i = 0; i < voiceSelect.options.length; i++) {
                    if (voiceSelect.options[i].dataset.name === previouslySelectedVoiceName) {
                        voiceSelect.options[i].selected = true;
                        lastSelectedVoiceName = previouslySelectedVoiceName;
                        foundAndRestored = true;
                        break;
                    }
                }
            }

            if (!foundAndRestored && voiceSelect.options.length > 0) {
                if (voiceSelect.options[0].hasAttribute('data-name')) {
                    voiceSelect.options[0].selected = true;
                    lastSelectedVoiceName = voiceSelect.options[0].dataset.name;
                } else {
                    lastSelectedVoiceName = null;
                }
            }
        }
    }
    
    // 语音加载延迟处理
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
    }
    
    // 初始化加载语音
    loadVoices();
    
    // 滑块事件监听
    rateRange.addEventListener('input', function() {
        rateValue.textContent = this.value;
    });
    
    // pitchRange.addEventListener('input', function() { // Commented out
    //     pitchValue.textContent = this.value;
    // });
    
    // 停止播放
    stopBtn.addEventListener('click', function() {
        if (isPlaying) {
            synth.cancel();
            isPlaying = false;
            updatePlaybackStatus();
        }
    });
    
    // 更新播放状态
    function updatePlaybackStatus() {
        stopBtn.disabled = !isPlaying;
        previewBtn.disabled = isPlaying;
        exportBtn.disabled = isPlaying;
        
        if (isPlaying) {
            stopBtn.classList.remove('opacity-50');
        } else {
            stopBtn.classList.add('opacity-50');
        }
    }
    
    // 预览播放
    previewBtn.addEventListener('click', function() {
        if (!storyText.value.trim()) {
            showStatusMessage('请输入要转换的文本', 'error');
            return;
        }
        
        const selectedOption = voiceSelect.selectedOptions[0];
        const selectedVoiceName = selectedOption && selectedOption.hasAttribute('data-name') ? selectedOption.dataset.name : null;

        if (!selectedVoiceName) {
            showStatusMessage('请选择一种声音', 'error');
            return;
        }
        lastSelectedVoiceName = selectedVoiceName;
        
        isPlaying = true;
        updatePlaybackStatus();
        
        utterance = new SpeechSynthesisUtterance();
        utterance.text = storyTitle.value ? `${storyTitle.value}。${storyText.value}` : storyText.value;
        utterance.rate = parseFloat(rateRange.value);
        
        const voice = voices.find(v => v.name === selectedVoiceName);
        if (voice) utterance.voice = voice;
        
        utterance.onend = function() {
            isPlaying = false;
            updatePlaybackStatus();
        };
        
        utterance.onerror = function(event) {
            isPlaying = false;
            updatePlaybackStatus();
            showStatusMessage('播放出错: ' + event.error, 'error');
        };
        
        synth.speak(utterance);
        showStatusMessage('正在播放预览...', 'info');
    });
    
    // 导出音频
    exportBtn.addEventListener('click', async function() {
        if (synth.speaking) {
            showStatusMessage('请等待当前朗读结束后再导出。', 'info');
            return;
        }
        if (!storyText.value.trim()) {
            showStatusMessage('请输入要转换的文本', 'error');
            return;
        }
        
        const selectedOption = voiceSelect.selectedOptions[0];
        const selectedVoiceName = selectedOption && selectedOption.hasAttribute('data-name') ? selectedOption.dataset.name : null;

        if (!selectedVoiceName) {
            showStatusMessage('请选择一种声音', 'error');
            return;
        }
        lastSelectedVoiceName = selectedVoiceName;
        
        let capturedStream = null; // To store the captured stream

        try {
            showStatusMessage('请在弹窗中选择"此标签页"或包含此应用的窗口，并确保勾选"共享音频"。', 'info');
            
            // Request permission to capture tab audio
            capturedStream = await navigator.mediaDevices.getDisplayMedia({
                video: true, // Video is often required, even if not used, to get audio reliably
                audio: {
                    // These constraints help ensure we get system/tab audio
                    // Suppress local audio playback to avoid echo if mic was also captured (though we ask for no mic)
                    suppressLocalAudioPlayback: true 
                },
                preferCurrentTab: true, // Hint to prefer the current tab
            });

            if (!capturedStream.getAudioTracks() || capturedStream.getAudioTracks().length === 0) {
                showStatusMessage('未能捕获到音频。请确保在分享时已勾选音频共享选项。', 'error');
                if (capturedStream) {
                    capturedStream.getTracks().forEach(track => track.stop());
                }
                return;
            }
            
            audioChunks = []; // Reset audio chunks
            
            let chosenMimeType = exportFormat.value;
            let initialChoice = exportFormat.value; // Store the user's initial selection
            let finalFileExtension = chosenMimeType.split('/')[1] === 'mpeg' ? 'mp3' : chosenMimeType.split('/')[1];

            // Fallback logic based on initial choice
            if (initialChoice === 'audio/mpeg') {
                if (!MediaRecorder.isTypeSupported(initialChoice)) {
                    showStatusMessage(`浏览器不支持导出 MP3 格式。正在尝试 WAV 格式...`, 'info');
                    console.warn('audio/mpeg is not supported. Trying audio/wav');
                    chosenMimeType = 'audio/wav';
                    finalFileExtension = 'wav';
                    if (!MediaRecorder.isTypeSupported(chosenMimeType)) {
                        showStatusMessage('浏览器也不支持 WAV 格式。正在尝试 WebM 格式...', 'info');
                        console.warn('audio/wav is not supported. Trying audio/webm');
                        chosenMimeType = 'audio/webm';
                        finalFileExtension = 'webm';
                        if (!MediaRecorder.isTypeSupported(chosenMimeType)) {
                            console.error('audio/webm is not supported either. Cannot record.');
                            showStatusMessage('抱歉，您的浏览器不支持任何可用的录音格式 (MP3, WAV, WebM)。', 'error');
                            if (capturedStream) { capturedStream.getTracks().forEach(track => track.stop()); }
                            return;
                        } else {
                            console.info('Fell back to audio/webm after MP3 and WAV failed isTypeSupported.');
                        }
                    } else {
                        console.info('Fell back to audio/wav after MP3 failed isTypeSupported.');
                    }
                } else {
                    // MP3 is directly supported
                    console.info('audio/mpeg is directly supported.');
                }
            } else if (initialChoice === 'audio/wav') {
                if (!MediaRecorder.isTypeSupported(initialChoice)) {
                    showStatusMessage(`浏览器不支持导出 WAV 格式。正在尝试 WebM 格式...`, 'info');
                    console.warn('audio/wav is not supported. Trying audio/webm');
                    chosenMimeType = 'audio/webm';
                    finalFileExtension = 'webm';
                    if (!MediaRecorder.isTypeSupported(chosenMimeType)) {
                        console.error('audio/webm is not supported either. Cannot record.');
                        showStatusMessage('抱歉，您的浏览器不支持任何可用的录音格式 (WAV, WebM)。', 'error');
                        if (capturedStream) { capturedStream.getTracks().forEach(track => track.stop()); }
                        return;
                    } else {
                        console.info('Fell back to audio/webm after WAV failed isTypeSupported.');
                    }
                } else {
                     // WAV is directly supported
                    console.info('audio/wav is directly supported.');
                }
            } // Add other initial choices if any in future

            showStatusMessage(`将以 ${finalFileExtension.toUpperCase()} 格式导出。`, 'info');

            try {
                console.log("Attempting mediaRecorder.start() with effective mimeType:", mediaRecorder.mimeType || "browser default (if init with no mimeType)"); 
                mediaRecorder.start();
                console.log("mediaRecorder.start() was called successfully (or did not throw an immediate synchronous error).");
            } catch (startError) {
                console.error("!!!!!!!!!! START ERROR CAUGHT (with chosenMimeType: '" + mediaRecorder.mimeType + "') !!!!!!!!!!!");
                console.error("Error Name:", startError.name);
                console.error("Error Message:", startError.message);
                console.error("Full Error Object:", startError);
                
                // LAST DITCH ATTEMPT: Try re-initializing MediaRecorder with no specified MIME type
                console.warn("Attempting last-ditch effort: Re-initialize MediaRecorder with NO MIME type (browser default).");
                showStatusMessage(`录制启动失败 (${mediaRecorder.mimeType}). 尝试浏览器默认配置...`, 'info');
                try {
                    if (!capturedStream.active) {
                        throw new Error("Stream became inactive before last-ditch attempt.");
                    }
                    mediaRecorder = new MediaRecorder(capturedStream); // Let browser pick its default
                    finalFileExtension = 'webm'; // Assume webm for browser default, user can rename if needed
                    console.log("Successfully re-initialized MediaRecorder with browser default. Attempting start() again.");
                    mediaRecorder.start(); // Try starting again with browser default
                    console.log("Successfully started MediaRecorder with browser default after initial start failed.");
                    // If this succeeds, the ondataavailable and onstop from the *outer* mediaRecorder instance will handle it.
                    // We need to ensure the original ondataavailable and onstop are still wired up if we re-assign mediaRecorder here.
                    // For simplicity in this last ditch, we'll assume the original handlers are okay.
                    // However, this means the original mediaRecorder.ondataavailable etc. need to be set up *after* all this init logic.
                    // This is getting complicated. Let's simplify the handler re-attachment for this specific last ditch effort.

                    // Re-attach handlers to the new mediaRecorder instance for this last ditch effort
                    mediaRecorder.ondataavailable = function(event) {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                        }
                    };
                    mediaRecorder.onstop = function() {
                        if (audioChunks.length === 0) {
                            showStatusMessage('录制失败 (默认配置)，没有捕获到音频数据。请重试。', 'error');
                        } else {
                            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' }); // Use actual mimeType if available
                            const audioUrl = URL.createObjectURL(audioBlob);
                            audioPreview.src = audioUrl;
                            audioPreviewContainer.classList.remove('hidden');
                            audioPreviewContainer.classList.add('show');
                            const a = document.createElement('a');
                            a.href = audioUrl;
                            const fileName = storyTitle.value ? `${storyTitle.value}.${finalFileExtension}` :
                                `story_voice_${new Date().toISOString().slice(0, 10)}.${finalFileExtension}`;
                            a.download = fileName;
                            a.click();
                            URL.revokeObjectURL(audioUrl);
                            showStatusMessage('音频使用浏览器默认配置导出成功!', 'success');
                        }
                        exportBtn.classList.remove('processing');
                        exportBtn.disabled = false;
                        if (capturedStream) {
                            capturedStream.getTracks().forEach(track => track.stop());
                        }
                    };
                    // The original utterance.onend and onerror will trigger this new mediaRecorder.stop()
                    // because the 'utterance' object itself is not re-created.

                } catch (lastDitchError) {
                    console.error("!!!!!!!!!! LAST DITCH START ERROR CAUGHT !!!!!!!!!!!");
                    console.error("Last Ditch Error Name:", lastDitchError.name);
                    console.error("Last Ditch Error Message:", lastDitchError.message);
                    console.error("Last Ditch Full Error Object:", lastDitchError);
                    showStatusMessage(`彻底无法启动录制: ${lastDitchError.message}`, 'error');
                    if (capturedStream) {
                        capturedStream.getTracks().forEach(track => track.stop());
                    }
                    exportBtn.classList.remove('processing');
                    exportBtn.disabled = false;
                    return; 
                }
            }
            
            showStatusMessage('正在录制音频...请勿切换标签页。', 'info');
            exportBtn.classList.add('processing');
            exportBtn.disabled = true; // Disable button while recording

            utterance = new SpeechSynthesisUtterance();
            utterance.text = storyTitle.value ? `${storyTitle.value}。${storyText.value}` : storyText.value;
            utterance.rate = parseFloat(rateRange.value);
            
            const voice = voices.find(v => v.name === selectedVoiceName);
            if (voice) utterance.voice = voice;
            
            utterance.onend = function() {
                if (mediaRecorder && mediaRecorder.state === "recording") {
                    mediaRecorder.stop(); 
                }
                // synth.speaking will be false here
                // Tracks are stopped in mediaRecorder.onstop
            };
            
            utterance.onerror = function(event) {
                if (mediaRecorder && mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                }
                showStatusMessage('语音合成或录制出错: ' + event.error, 'error');
                exportBtn.classList.remove('processing');
                exportBtn.disabled = false;
                if (capturedStream) {
                    capturedStream.getTracks().forEach(track => track.stop());
                }
            };
            
            synth.speak(utterance);

        } catch (error) {
            console.error("Error during audio export:", error);
            showStatusMessage(`导出音频失败: ${error.message}. 请确保已授予屏幕录制权限并选择了正确的标签页/窗口和音频共享。`, 'error');
            exportBtn.classList.remove('processing');
            exportBtn.disabled = false;
            if (capturedStream) {
                capturedStream.getTracks().forEach(track => track.stop());
            }
        }
    });
    
    // 显示状态消息
    function showStatusMessage(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = '';
        statusMessage.classList.add(type);
        statusMessage.classList.remove('hidden');
        
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 3000);
    }
    
    // 字数统计
    storyText.addEventListener('input', function() {
        // Calculate word count based on Chinese characters or English words
        const text = storyText.value;
        let wordCount = 0;
        if (text.match(/[\u4e00-\u9fa5]/)) { // Check if text contains Chinese characters
            wordCount = text.length; // For Chinese, count characters
        } else {
            const words = text.match(/\b\w+\b/g); // For English, count words
            wordCount = words ? words.length : 0;
        }

        const countElement = document.querySelector('.word-count');
        const labelElement = storyText.previousElementSibling; // Get the label "雅思口语范例"
        
        if (countElement) {
            countElement.textContent = `${wordCount} ${text.match(/[\u4e00-\u9fa5]/) ? '字' : 'words'}`;
        } else {
            const newCountElement = document.createElement('div');
            newCountElement.className = 'word-count';
            newCountElement.textContent = `${wordCount} ${text.match(/[\u4e00-\u9fa5]/) ? '字' : 'words'}`;
            // Insert the count element after the textarea, but ideally aligned with its label or in a consistent place
            // For simplicity, placing after textarea. Better structure would be a dedicated div for label + count
            if (labelElement && labelElement.parentNode) {
                 labelElement.parentNode.insertBefore(newCountElement, storyText.nextSibling);
            } else {
                storyText.parentNode.appendChild(newCountElement);
            }
        }
    });

    // Generate Question Button Event Listener
    generateQuestionBtn.addEventListener('click', async function() {
        const selectedPart = ieltsPartSelect.value;
        const selectedLevel = ieltsLevelSelect.value;
        let prompt = '';

        const systemMessage = `You are an IELTS speaking test simulator. Your task is to generate a question (or cue card) and a sample answer. The sample answer MUST be tailored to an IELTS band score of ${selectedLevel}. This means the vocabulary, grammatical structures, and complexity of the answer should reflect what a candidate at band ${selectedLevel} would typically produce. Provide only the question (or cue card topic and points) and the sample answer (or speech). Do not include any explanations, notes, or commentary about why the answer is good or how it aligns with IELTS criteria. Ensure the output strictly adheres to the requested format: For Part 1 and Part 3, use 'Question:' on a new line before the question, and 'Answer:' on a new line before the answer. For Part 2, use 'Cue Card:' on a new line before the cue card (topic and bullet points), and 'Sample Speech:' on a new line before the sample speech. Provide nothing else. The question itself should remain natural and typical for any IELTS level, but the answer must reflect band ${selectedLevel}.`;

        if (selectedPart === 'part1') {
            prompt = `Generate an IELTS Speaking Part 1 question and a concise, natural-sounding sample answer. The sample answer should be representative of IELTS band ${selectedLevel}. Provide only the question and the answer, using the specified formatting. Do not add any extra commentary.`;
        } else if (selectedPart === 'part2') {
            prompt = `Generate an IELTS Speaking Part 2 cue card (topic and 3-4 bullet points) and a sample 2-minute speech. The sample speech should be representative of IELTS band ${selectedLevel}. Provide only the cue card and the sample speech, using the specified formatting. Do not add any extra commentary.`;
        } else if (selectedPart === 'part3') {
            prompt = `Generate an IELTS Speaking Part 3 follow-up question and a well-reasoned sample answer exploring different perspectives. The sample answer should be representative of IELTS band ${selectedLevel}. Provide only the question and the answer, using the specified formatting. Do not add any extra commentary.`;
        }

        if (!prompt) return;

        generateQuestionBtn.disabled = true;
        generateQuestionBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>正在生成...';
        showStatusMessage('正在生成雅思范例，请稍候...', 'info');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: [
                        { role: "system", content: systemMessage },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 700 
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`API 请求失败，状态码 ${response.status}: ${errorData ? JSON.stringify(errorData) : response.statusText}`);
            }

            const data = await response.json();
            const textOutput = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content 
                                ? data.choices[0].message.content.trim()
                                : '';

            if (textOutput) {
                let question = '';
                let answer = '';

                if (selectedPart === 'part2') {
                    const cueCardMarker = "Cue Card:";
                    const speechMarker = "Sample Speech:";
                    const cueCardIndex = textOutput.indexOf(cueCardMarker);
                    const speechIndex = textOutput.indexOf(speechMarker);

                    if (cueCardIndex !== -1 && speechIndex !== -1 && speechIndex > cueCardIndex) {
                        question = textOutput.substring(cueCardIndex + cueCardMarker.length, speechIndex).trim();
                        answer = textOutput.substring(speechIndex + speechMarker.length).trim();
                    } else {
                        question = "无法正确解析提示卡/范例演说。";
                        answer = textOutput;
                    }
                } else { // Part 1 and Part 3
                    const questionMarker = "Question:";
                    const answerMarker = "Answer:";
                    const questionIndex = textOutput.indexOf(questionMarker);
                    const answerIndex = textOutput.indexOf(answerMarker);

                    if (questionIndex !== -1 && answerIndex !== -1 && answerIndex > questionIndex) {
                        question = textOutput.substring(questionIndex + questionMarker.length, answerIndex).trim();
                        answer = textOutput.substring(answerIndex + answerMarker.length).trim();
                    } else {
                        question = "无法正确解析问题/答案。";
                        answer = textOutput;
                    }
                }

                storyTitle.value = question;
                storyText.value = answer;
                showStatusMessage('雅思范例已成功生成！', 'success');
            } else {
                storyTitle.value = '错误';
                storyText.value = '未能从API获取内容。';
                showStatusMessage('未能从API获取内容。', 'error');
            }

        } catch (error) {
            console.error('获取雅思范例时出错:', error);
            storyTitle.value = 'API错误';
            storyText.value = `数据加载失败: ${error.message}`;
            showStatusMessage(`错误: ${error.message}`, 'error');
        } finally {
            generateQuestionBtn.disabled = false;
            generateQuestionBtn.innerHTML = '<i class="fas fa-magic mr-2"></i>生成问题与范例';
        }
    });
});
