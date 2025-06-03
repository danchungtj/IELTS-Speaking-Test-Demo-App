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
    exportBtn.addEventListener('click', function() {
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
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        mediaRecorder = new MediaRecorder(destination.stream);
        audioChunks = [];
        
        mediaRecorder.start();
        showStatusMessage('正在生成音频...', 'info');
        exportBtn.classList.add('processing');
        
        mediaRecorder.ondataavailable = function(event) {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = function() {
            const audioBlob = new Blob(audioChunks, { type: exportFormat.value });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            audioPreview.src = audioUrl;
            audioPreviewContainer.classList.remove('hidden');
            audioPreviewContainer.classList.add('show');
            
            const a = document.createElement('a');
            a.href = audioUrl;
            const fileName = storyTitle.value ? `${storyTitle.value}.${exportFormat.value.split('/')[1]}` : 
                             `story_voice_${new Date().toISOString().slice(0, 10)}.${exportFormat.value.split('/')[1]}`;
            a.download = fileName;
            a.click();
            
            showStatusMessage('音频导出成功!', 'success');
            exportBtn.classList.remove('processing');
        };
        
        utterance = new SpeechSynthesisUtterance();
        utterance.text = storyTitle.value ? `${storyTitle.value}。${storyText.value}` : storyText.value;
        utterance.rate = parseFloat(rateRange.value);
        
        const voice = voices.find(v => v.name === selectedVoiceName);
        if (voice) utterance.voice = voice;
        
        const utteranceNode = new SpeechSynthesisUtteranceNode(audioContext, utterance);
        utteranceNode.connect(destination);
        
        utterance.onend = function() {
            mediaRecorder.stop();
        };
        
        utterance.onerror = function(event) {
            mediaRecorder.stop();
            showStatusMessage('生成音频出错: ' + event.error, 'error');
            exportBtn.classList.remove('processing');
        };
        
        synth.speak(utterance);
    });
    
    // 自定义SpeechSynthesisUtterance节点
    function SpeechSynthesisUtteranceNode(audioContext, utterance) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 0;
        gainNode.gain.value = 0;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        
        // 模拟语音合成
        utterance.onboundary = function(event) {
            if (event.name === 'word') {
                gainNode.gain.value = 1;
                setTimeout(() => {
                    gainNode.gain.value = 0;
                }, 100);
            }
        };
        
        return {
            connect: function(destination) {
                gainNode.connect(destination);
            }
        };
    }
    
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
        const wordCount = storyText.value.length;
        const countElement = document.createElement('div');
        countElement.className = 'word-count';
        countElement.textContent = `${wordCount} 字`;
        
        if (!document.querySelector('.word-count')) {
            storyText.parentNode.appendChild(countElement);
        } else {
            document.querySelector('.word-count').textContent = `${wordCount} 字`;
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
