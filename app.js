// ==============================
// CONFIGURATION
// ==============================

const QUESTIONS_URL =
  "https://raw.githubusercontent.com/Carl-in-Vermont/questions/main/questions.json";

// LocalStorage keys
const CACHE_KEY = "spartans_questions_cache";
const SEEN_KEY = "spartans_seen_questions";       // JSON array of strings (question texts)
const CURRENT_KEY = "spartans_current_question";  // string (question text)

const FALLBACK_QUESTIONS = [
  "What feels most alive for you right now?",
  "What are you noticing that surprised you?",
  "What question are you holding today?"
];

let questions = [];
let seen = new Set();
let current = "";

// ==============================
// HELPERS
// ==============================

function loadSeenSet() {
  const raw = localStorage.getItem(SEEN_KEY);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter(x => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveSeenSet() {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

function loadCurrent() {
  const c = localStorage.getItem(CURRENT_KEY);
  return typeof c === "string" ? c : "";
}

function saveCurrent() {
  localStorage.setItem(CURRENT_KEY, current);
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function computeUnseenList() {
  return questions.filter(q => !seen.has(q));
}

function isValidQuestionList(list) {
  return Array.isArray(list) && list.length > 0 && list.every(q => typeof q === "string");
}

// Accept either:
// 1) [ "q1", "q2" ]
// 2) { "questions": [ "q1", "q2" ] }
function extractQuestionsJson(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.questions)) return data.questions;
  return null;
}

// ==============================
// RENDERING
// ==============================

function render() {
  const el = document.getElementById("question");
  if (!questions.length) {
    el.textContent = "No questions available.";
    return;
  }

  const unseenNow = computeUnseenList();
  const isCurrentUnseen = current && unseenNow.includes(current);
  const unseenAfterShowingCurrent = isCurrentUnseen ? unseenNow.length - 1 : unseenNow.length;

  if (unseenAfterShowingCurrent === 0) {
    el.textContent =
      current +
      "\n\nThis is the final question on the current list. " +
      "The Next Question button will return to the first question on the list. " +
      "Text a request to Uncle Carl to refresh the list.";
  } else {
    el.textContent = current;
  }
}

// ==============================
// QUESTION FLOW
// ==============================

function ensureCurrentQuestion() {
  const savedCurrent = loadCurrent();
  if (savedCurrent && questions.includes(savedCurrent)) {
    current = savedCurrent;
    return;
  }
  pickNextQuestion(false);
}

function pickNextQuestion(markCurrentSeen) {
  if (!questions.length) return;

  if (markCurrentSeen && current) {
    seen.add(current);
    saveSeenSet();
  }

  let unseen = computeUnseenList();

  if (unseen.length === 0) {
    seen = new Set();
    saveSeenSet();
    unseen = questions.slice();
  }

  current = randomChoice(unseen);
  saveCurrent();
  render();
}

// ==============================
// DATA LOADING
// ==============================

async function fetchRemoteQuestions() {
  const response = await fetch(QUESTIONS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Network error: ${response.status}`);

  const data = await response.json();
  const list = extractQuestionsJson(data);

  if (!isValidQuestionList(list)) throw new Error("Invalid questions JSON format");
  return list;
}

function useCachedOrFallbackQuestions() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (isValidQuestionList(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return FALLBACK_QUESTIONS;
}

function reconcileSeenAndCurrent() {
  const qset = new Set(questions);

  // Remove seen questions that no longer exist
  seen = new Set([...seen].filter(q => qset.has(q)));
  saveSeenSet();

  // If current question no longer exists, choose a new one
  const savedCurrent = loadCurrent();
  if (savedCurrent && qset.has(savedCurrent)) {
    current = savedCurrent;
    saveCurrent();
  } else {
    current = "";
    saveCurrent();
    ensureCurrentQuestion();
  }

  render();
}

async function loadQuestionsInitial() {
  seen = loadSeenSet();

  try {
    questions = await fetchRemoteQuestions();
    localStorage.setItem(CACHE_KEY, JSON.stringify(questions));
  } catch (err) {
    console.warn("Using cached or fallback questions:", err);
    questions = useCachedOrFallbackQuestions();
  }

  reconcileSeenAndCurrent();
}

// ==============================
// BUTTON HANDLERS
// ==============================

document.getElementById("nextBtn").addEventListener("click", () => {
  const confirmed = window.confirm("Are you sure you want to move to the next question?");
  if (!confirmed) return;
  pickNextQuestion(true);
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Refresh questions from the repository now?\n\n(Works only if you have internet.)"
  );
  if (!confirmed) return;

  try {
    const latest = await fetchRemoteQuestions();
    questions = latest;
    localStorage.setItem(CACHE_KEY, JSON.stringify(questions));

    // Keep seen/current only if still valid
    seen = loadSeenSet();
    reconcileSeenAndCurrent();

    alert("Questions refreshed successfully.");
  } catch (err) {
    console.warn("Refresh failed:", err);
    alert("Could not refresh questions right now. Using the cached list.");
    // Keep current state; app continues with cached questions already in memory.
  }
});

// ==============================
// STARTUP
// ==============================

loadQuestionsInitial();

// ==============================
// SERVICE WORKER
// ==============================

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}
