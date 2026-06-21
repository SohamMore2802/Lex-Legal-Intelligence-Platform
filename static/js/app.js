const uploadForm = document.getElementById("upload-form");
const queryForm = document.getElementById("query-form");
const uploadStatus = document.getElementById("upload-status");
const queryStatus = document.getElementById("query-status");
const documentName = document.getElementById("document-name");
const pageCount = document.getElementById("page-count");
const chunkCount = document.getElementById("chunk-count");
const answerOutput = document.getElementById("answer-output");
const citationList = document.getElementById("citation-list");
const selectedFile = document.getElementById("selected-file");
const querySuggestions = document.querySelectorAll(".suggestion-pill");
const recentUploads = document.getElementById("recent-uploads");
const recentQueries = document.getElementById("recent-queries");
const copyAnswer = document.getElementById("copy-answer");
const themeToggle = document.getElementById("theme-toggle");

let documentLoaded = false;
let uploadHistory = [];
let queryHistory = [];

function getStoredTheme() {
  return localStorage.getItem("lex-theme") || "dark";
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light-mode", theme === "light");
  if (themeToggle) {
    themeToggle.textContent = theme === "light" ? "Dark mode" : "Light mode";
  }
  localStorage.setItem("lex-theme", theme);
}

function toggleTheme() {
  const nextTheme = getStoredTheme() === "light" ? "dark" : "light";
  applyTheme(nextTheme);
}

function renderHistory(container, items, emptyMessage) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<li>${emptyMessage}</li>`;
    return;
  }
  container.innerHTML = items
    .slice(0, 5)
    .map((item) => `<li>${item}</li>`)
    .join("");
}

async function refreshDocumentStatus() {
  try {
    const response = await fetch("/status");
    const result = await response.json();
    if (!result.success) {
      return;
    }

    if (result.loaded) {
      documentLoaded = true;
      documentName.textContent = result.document_name || "Uploaded document";
      pageCount.textContent = result.page_count || 0;
      chunkCount.textContent = result.chunk_count || 0;
      uploadStatus.textContent = "Document already uploaded.";
      answerOutput.textContent = "Your document is ready. Ask a question below.";
    }
  } catch (error) {
    console.warn("Could not load document status:", error);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  if (uploadForm) {
    const fileInput = uploadForm.querySelector("input[type=\"file\"]");
    if (fileInput && selectedFile) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        selectedFile.textContent = file ? file.name : "Choose a PDF to begin.";
      });
    }

    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      uploadStatus.textContent = "Uploading and processing document...";
      queryStatus.textContent = "";
      answerOutput.textContent = "Waiting for upload to complete...";
      citationList.innerHTML = "";

      const formData = new FormData(uploadForm);
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        uploadStatus.textContent = result.message || "Upload failed.";
        answerOutput.textContent = "";
        return;
      }

      uploadStatus.textContent = "Document uploaded successfully.";
      documentName.textContent = result.metadata.document_name;
      pageCount.textContent = result.metadata.page_count;
      chunkCount.textContent = result.metadata.chunk_count;
      answerOutput.textContent = "Your document is ready. Ask a question below.";
      documentLoaded = true;
      uploadHistory.unshift(result.metadata.document_name);
      renderHistory(recentUploads, uploadHistory, "No uploads yet.");
      updateDocumentChart(result.metadata.page_count, result.metadata.chunk_count);
      await refreshAnalysis();
    });
  }

  if (querySuggestions.length > 0) {
    querySuggestions.forEach((button) => {
      button.addEventListener("click", () => {
        const questionInput = document.getElementById("question");
        questionInput.value = button.textContent;
        questionInput.focus();
        queryStatus.textContent = "";
      });
    });
  }

  if (queryForm) {
    queryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!documentLoaded) {
        queryStatus.textContent = "Upload a document first.";
        return;
      }

      queryStatus.textContent = "Generating answer...";
      answerOutput.textContent = "";
      citationList.innerHTML = "";

      const question = document.getElementById("question").value.trim();
      if (!question) {
        queryStatus.textContent = "Please type a question.";
        return;
      }

      const response = await fetch("/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const result = await response.json();
      if (!result.success) {
        queryStatus.textContent = result.message || "Could not generate answer.";
        return;
      }

      queryStatus.textContent = "Answer generated successfully.";
      answerOutput.textContent = result.result.answer;
      queryHistory.unshift(question);
      renderHistory(recentQueries, queryHistory, "Ask your first question.");
      updateScoreChart(result.result.retrieved);

      citationList.innerHTML = result.result.retrieved
        .map(
          (item) =>
            `<li class="citation-item"><strong>Page ${item.page}</strong><p>${item.text}</p></li>`
        )
        .join("");
    });
  }

  refreshDocumentStatus();
  refreshAnalysis();
  renderHistory(recentUploads, uploadHistory, "No uploads yet.");
  renderHistory(recentQueries, queryHistory, "Ask your first question.");
  applyTheme(getStoredTheme());

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  if (copyAnswer) {
    copyAnswer.addEventListener("click", async () => {
      const answerText = answerOutput.textContent.trim();
      if (!answerText || answerText === "Upload a document to get started.") {
        queryStatus.textContent = "Nothing to copy yet.";
        return;
      }
      await navigator.clipboard.writeText(answerText);
      queryStatus.textContent = "Answer copied to clipboard.";
      setTimeout(() => {
        queryStatus.textContent = "";
      }, 2400);
    });
  }
});

async function refreshAnalysis() {
  if (!documentLoaded) {
    return;
  }

  try {
    const response = await fetch("/analysis");
    const result = await response.json();
    if (!result.success) {
      return;
    }

    const summary = document.getElementById("document-summary");
    const keywordList = document.getElementById("keyword-list");
    const pagePreview = document.getElementById("page-preview");
    const readabilityScore = document.getElementById("readability-score");
    const wordCount = document.getElementById("word-count");
    const avgChunkLength = document.getElementById("avg-chunk-length");
    const keySections = document.getElementById("key-sections");
    const topPhrases = document.getElementById("top-phrases");

    if (summary) {
      summary.textContent = result.summary || "No summary available.";
    }
    if (keywordList) {
      keywordList.innerHTML = result.keywords
        .map((keyword) => `<li>${keyword}</li>`)
        .join("");
    }
    if (pagePreview) {
      pagePreview.textContent = result.page_preview || "Preview not available.";
    }
    if (readabilityScore) {
      readabilityScore.textContent = result.readability_score
        ? `${result.readability_score} / 100`
        : "—";
    }
    if (wordCount) {
      wordCount.textContent = result.approximate_word_count || "—";
    }
    if (avgChunkLength) {
      avgChunkLength.textContent = result.average_chunk_length || "—";
    }
    if (keySections) {
      keySections.innerHTML = result.key_sections && result.key_sections.length
        ? result.key_sections
            .map((section) => `<span class="chip">${section}</span>`)
            .join("")
        : `<span class="chip chip-empty">No sections found.</span>`;
    }
    if (topPhrases) {
      topPhrases.innerHTML = result.top_phrases && result.top_phrases.length
        ? result.top_phrases
            .map((phrase) => `<span class="chip">${phrase}</span>`)
            .join("")
        : `<span class="chip chip-empty">No phrases found.</span>`;
    }
  } catch (error) {
    console.warn("Could not load analysis:", error);
  }
}

const resetButton = document.getElementById("reset-button");
if (resetButton) {
  resetButton.addEventListener("click", async () => {
    await fetch("/reset", { method: "POST" });
    documentLoaded = false;
    documentName.textContent = "No document uploaded";
    pageCount.textContent = "0";
    chunkCount.textContent = "0";
    uploadStatus.textContent = "Document reset.";
    answerOutput.textContent = "Upload a document to get started.";
    citationList.innerHTML = "";
    const summary = document.getElementById("document-summary");
    const keywordList = document.getElementById("keyword-list");
    if (summary) summary.textContent = "Summary will appear after upload.";
    if (keywordList) keywordList.innerHTML = "<li>No keywords yet.</li>";
    updateDocumentChart(0, 0);
    updateScoreChart([]);
  });
}

// Realtime chart + socket.io integration
const liveValueSpan = document.getElementById("live-value");
const chartCanvas = document.getElementById("realtime-chart");
const documentChartCanvas = document.getElementById("document-chart");
const scoreChartCanvas = document.getElementById("score-chart");
let realtimeChart = null;
let documentChart = null;
let scoreChart = null;

function renderHistory(container, items, emptyMessage) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<li>${emptyMessage}</li>`;
    return;
  }
  container.innerHTML = items
    .slice(0, 5)
    .map((item) => `<li>${item}</li>`)
    .join("");
}

function initRealtimeChart() {
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext("2d");
  realtimeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Live metric",
          data: [],
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      animation: { duration: 300 },
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: true, title: { display: false } },
        y: { beginAtZero: true },
      },
    },
  });
}

function addRealtimePoint(ts, value) {
  if (!realtimeChart) return;
  const label = new Date(ts).toLocaleTimeString();
  const maxPoints = 60;
  realtimeChart.data.labels.push(label);
  realtimeChart.data.datasets[0].data.push(value);
  if (realtimeChart.data.labels.length > maxPoints) {
    realtimeChart.data.labels.shift();
    realtimeChart.data.datasets[0].data.shift();
  }
  realtimeChart.update("none");
  if (liveValueSpan) liveValueSpan.textContent = value.toFixed(2);
}

function initDocumentChart() {
  if (!documentChartCanvas) return;
  const ctx = documentChartCanvas.getContext("2d");
  documentChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pages", "Chunks"],
      datasets: [
        {
          label: "Document overview",
          data: [0, 0],
          backgroundColor: ["rgba(124, 92, 255, 0.85)", "rgba(62, 170, 255, 0.85)"],
          borderRadius: 14,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" } },
        x: { grid: { display: false } },
      },
    },
  });
}

function updateDocumentChart(pages, chunks) {
  if (!documentChart) return;
  documentChart.data.datasets[0].data = [pages, chunks];
  documentChart.update("none");
}

function initScoreChart() {
  if (!scoreChartCanvas) return;
  const ctx = scoreChartCanvas.getContext("2d");
  scoreChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Top similarity scores",
          data: [],
          borderColor: "rgba(124, 92, 255, 1)",
          backgroundColor: "rgba(124, 92, 255, 0.16)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "rgba(255,255,255,0.9)",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, max: 1, grid: { color: "rgba(255,255,255,0.08)" } },
        x: { grid: { display: false } },
      },
    },
  });
}

function updateScoreChart(retrieved) {
  if (!scoreChart) return;
  if (!retrieved || retrieved.length === 0) {
    scoreChart.data.labels = ["No data"];
    scoreChart.data.datasets[0].data = [0];
    scoreChart.update("none");
    return;
  }
  scoreChart.data.labels = retrieved.map((item) => `Page ${item.page}`);
  scoreChart.data.datasets[0].data = retrieved.map((item) => Number(item.score.toFixed(3)));
  scoreChart.update("none");
}

// Initialize chart and open socket connection
window.addEventListener("DOMContentLoaded", () => {
  initRealtimeChart();
  initDocumentChart();
  initScoreChart();
  // `io` is provided by /socket.io/socket.io.js included in base.html
  try {
    const socket = io();
    socket.on("connect", () => {
      console.log("Realtime socket connected", socket.id);
    });
    socket.on("realtime_update", (payload) => {
      addRealtimePoint(payload.ts, payload.value);
    });
  } catch (err) {
    console.warn("Socket connection failed:", err);
  }
});
