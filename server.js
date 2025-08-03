const express = require('express');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const axios = require('axios');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static('public'));
app.use(express.json());

// 🧠 Cache temporário simples em memória
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

app.post('/analyze', async (req, res) => {
  const newsText = req.body.newsText;

  if (!newsText) {
    return res.status(400).json({ error: 'Texto da notícia não fornecido' });
  }

  // Verifica se existe cache válido
  const now = Date.now();
  if (cache[newsText] && now - cache[newsText].timestamp < CACHE_TTL) {
    return res.json(cache[newsText].data);
  }

  let fontesGNews = '';
  let fontesSerper = '';
  let fontesNewsAPI = '';
  let contextoFontes = '';

  // 🔍 GNEWS
  try {
    const gnewsResponse = await axios.get(`https://gnews.io/api/v4/search?q=${encodeURIComponent(newsText)}&token=${process.env.GNEWS_API_KEY}&lang=pt`);
    const articles = gnewsResponse.data.articles;

    if (articles.length > 0) {
      fontesGNews = articles.map(article => `• ${article.title} (${article.source.name} - ${article.url})`).join("\n");
    } else {
      fontesGNews = 'Nenhuma notícia relevante encontrada na GNews.';
    }
  } catch (err) {
    console.error('Erro ao buscar no GNews:', err.message);
    fontesGNews = 'Erro ao buscar no GNews.';
  }

  // 🔎 SERPER (Google Search API)
  try {
    const serperResponse = await axios.post(
      'https://google.serper.dev/search',
      { q: newsText },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const organic = serperResponse.data.organic;
    if (organic && organic.length > 0) {
      fontesSerper = organic.map(result => `• ${result.title} (${result.link})`).join("\n");
    } else {
      fontesSerper = 'Nenhum resultado relevante encontrado no Serper.';
    }
  } catch (err) {
    console.error('Erro ao buscar no Serper:', err.message);
    fontesSerper = 'Erro ao buscar no Serper.';
  }

  // 📰 NEWSAPI
  try {
    const newsApiResponse = await axios.get(`https://newsapi.org/v2/everything?q=${encodeURIComponent(newsText)}&language=pt&apiKey=${process.env.NEWS_API_KEY}`);
    const articles = newsApiResponse.data.articles;

    if (articles.length > 0) {
      fontesNewsAPI = articles.map(article => `• ${article.title} (${article.source.name} - ${article.url})`).join("\n");
    } else {
      fontesNewsAPI = 'Nenhuma notícia relevante encontrada na NewsAPI.';
    }
  } catch (err) {
    console.error('Erro ao buscar na NewsAPI:', err.message);
    fontesNewsAPI = 'Erro ao buscar na NewsAPI.';
  }

  // 🔧 Construção do contexto para o OpenAI
  contextoFontes = `
Fontes encontradas na GNews:
${fontesGNews}

Fontes encontradas no Google Search (Serper):
${fontesSerper}

Fontes encontradas na NewsAPI:
${fontesNewsAPI}
`;

  // 📩 Prompt final
  const prompt = `
Você é um verificador de fatos especializado em notícias. Abaixo está uma notícia para ser analisada.

Notícia recebida:
"${newsText}"

Com base nas informações extraídas das buscas em fontes confiáveis (GNews, Google Search e NewsAPI), faça uma avaliação crítica respondendo:

1. A notícia foi encontrada nas fontes confiáveis?
2. Há consenso entre os veículos sobre os fatos?
3. Há sinais de linguagem sensacionalista, emocional, manipuladora ou ausência de fontes verificáveis?
4. O conteúdo apresenta sinais de manipulação ou viés?

${contextoFontes}

Responda com o seguinte formato:

Veredito: [Confiável / Falsa / Tendenciosa]
Explicação: [Análise crítica baseada nas fontes, linguagem e evidências.]
Fontes/Verificação: [Mencione os veículos e links relevantes usados para confirmar ou refutar a notícia.]
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5
      })
    });

    const data = await response.json();
    console.log(data);

    if (!data.choices || !data.choices[0]) {
      return res.status(500).json({ error: "Erro ao processar resposta da IA" });
    }

    const reply = data.choices[0].message.content;
    const [vereditoTexto, explicacaoTexto] = reply.split("Explicação:");

    if (!vereditoTexto || !explicacaoTexto) {
      return res.status(500).json({ error: "Erro ao processar a resposta completa" });
    }

    const [explicacaoFinal, fontesTexto] = explicacaoTexto.split("Fontes/Verificação:");

    const result = {
      veredito: vereditoTexto.trim(),
      explicacao: explicacaoFinal.trim(),
      fontes: fontesTexto ? fontesTexto.trim() : "Fontes não fornecidas."
    };

    // Salva no cache
    cache[newsText] = {
      data: result,
      timestamp: Date.now()
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao analisar a notícia.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
