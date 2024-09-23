require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));

// OCR API 요청 처리
app.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;

    // 파일 형식 확인
    if (path.extname(filePath).toLowerCase() !== '.pdf') {
        return res.status(400).json({ error: '업로드된 파일이 PDF 형식이 아닙니다.' });
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    try {
        // OCR API 요청
        const response = await axios.post('https://api.ocr-service.com/parse', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.OCR_API_KEY}`
            }
        });

        fs.unlinkSync(filePath); // 업로드된 파일 삭제
        console.log('OCR API 응답:', response.data); // 응답 데이터 출력
        res.json({ text: response.data.text });
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'OCR 실패' });
    }
});

// ChatGPT API 요청 처리
app.post('/generate', async (req, res) => {
    const { questionType, questionCount, textInput, language } = req.body;

    let prompt;
    if (language === 'ko') {
        if (questionType === 'multiple-choice') {
            prompt = `다음 텍스트를 기반으로 ${questionCount}개의 객관식 문제를 생성해줘. 각 문제는 번호로 구분하고, 문제와 4개의 선택지를 명확히 구분해줘. 형식은 다음과 같아야 해: "문제 {번호}: {문제 내용}\n1. {선택지1}\n2. {선택지2}\n3. {선택지3}\n4. {선택지4}\n(답: {정답})"`;
        } else {
            prompt = `다음 텍스트를 기반으로 ${questionCount}개의 ${questionType} 문제를 생성해줘. 각 문제는 번호로 구분하고, 문제와 답을 명확히 구분해줘. 형식은 다음과 같아야 해: "문제 {번호}: {문제 내용} (답: {정답})"`;
        }
    } else {
        if (questionType === 'multiple-choice') {
            prompt = `Based on the following text, generate ${questionCount} multiple-choice questions. Each question should be numbered and clearly separate the question and 4 options. The format should be: "Question {number}: {question content}\n1. {option1}\n2. {option2}\n3. {option3}\n4. {option4}\n(Answer: {answer})"`;
        } else {
            prompt = `Based on the following text, generate ${questionCount} ${questionType} questions. Each question should be numbered and clearly separate the question and answer. The format should be: "Question {number}: {question content} (Answer: {answer})"`;
        }
    }

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: prompt
                },
                {
                    role: 'user',
                    content: textInput
                }
            ],
            max_tokens: 1500,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.CHATGPT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const questions = response.data.choices[0].message.content.split('\n').filter(line => line.trim() !== '');

        res.json({ questions });
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: '문제 생성 실패' });
    }
});

// 모든 IP 주소에서 접속 가능하도록 설정
app.listen(port, '0.0.0.0', () => {
    console.log(`서버가 http://0.0.0.0:${port}에서 실행 중입니다`);
});