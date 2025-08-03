document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const newsText = document.getElementById('newsInput').value;
    const verdictEl = document.getElementById('verdict');
    const explanationEl = document.getElementById('explanation');
  
    if (!newsText.trim()) {
      verdictEl.textContent = "Por favor, cole uma notícia antes de analisar.";
      explanationEl.textContent = "";
      return;
    }
  
    verdictEl.textContent = "Analisando...";
    explanationEl.textContent = "";
  
    try {
      const response = await fetch("https://fakenews-backend.onrender.com/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ newsText })
      });
  
      const data = await response.json();
      if (data.veredito) {
        verdictEl.textContent = data.veredito;
        explanationEl.textContent = "Explicação: " + data.explicacao;
      } else {
        verdictEl.textContent = "Erro ao analisar a notícia.";
        explanationEl.textContent = "Tente novamente.";
      }
    } catch (error) {
      verdictEl.textContent = "Erro ao analisar a notícia.";
      explanationEl.textContent = "Verifique sua conexão ou a chave da API.";
      console.error(error);
    }
  });
  