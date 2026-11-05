// TOMA frontend starter. Set this to your deployed Worker URL if API is hosted separately.
const TOMA_API_BASE = ""; // Example: "https://toma-streaming-api.YOUR-SUBDOMAIN.workers.dev"

const toast = document.getElementById("toast");
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

document.getElementById("year").textContent = new Date().getFullYear();

const accountDialog = document.getElementById("accountDialog");
document.getElementById("accountBtn").addEventListener("click", () => accountDialog.showModal());

document.querySelector(".close").addEventListener("click", () => accountDialog.close());

const searchRow = document.getElementById("searchRow");
document.getElementById("searchToggle").addEventListener("click", () => {
  searchRow.classList.toggle("visible");
  if (searchRow.classList.contains("visible")) document.getElementById("searchInput").focus();
});

let activeFilter = "all";
function filterCards() {
  const term = document.getElementById("searchInput").value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll(".title-card").forEach(card => {
    const matchesType = activeFilter === "all" || card.dataset.type === activeFilter;
    const matchesTerm = `${card.dataset.name} ${card.dataset.genre}`.toLowerCase().includes(term);
    const show = matchesType && matchesTerm;
    card.hidden = !show;
    if (show) visible++;
  });
  document.getElementById("emptyState").hidden = visible !== 0;
}
document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    filterCards();
  });
});
document.getElementById("searchInput").addEventListener("input", filterCards);

document.getElementById("subscribeBtn").addEventListener("click", async () => {
  const email = prompt("Enter your email address to continue to Paystack:");
  if (!email) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    showToast("Please enter a valid email address.");
    return;
  }
  try {
    const response = await fetch(`${TOMA_API_BASE}/api/paystack/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() })
    });
    const data = await response.json();
    if (!response.ok || !data.authorization_url) {
      showToast(data.error || "Payment service is not configured yet.");
      return;
    }
    window.location.href = data.authorization_url;
  } catch {
    showToast("Cannot reach the payment API. Deploy and configure the Worker first.");
  }
});

// Load live catalogue from the Worker when available; demo cards remain as fallback.
(async function loadCatalogue() {
  try {
    const response = await fetch(`${TOMA_API_BASE}/api/titles`);
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.titles) || data.titles.length === 0) return;
    const cards = document.getElementById("cards");
    cards.innerHTML = "";
    for (const item of data.titles) {
      const article = document.createElement("article");
      article.className = "title-card";
      article.dataset.type = item.type;
      article.dataset.name = item.title || "";
      article.dataset.genre = item.genre || "";
      const cover = document.createElement("div");
      cover.className = "cover cover-one";
      cover.style.backgroundImage = item.poster_url ? `linear-gradient(0deg,#09040f 0%,transparent 80%), url("${item.poster_url}")` : "";
      cover.style.backgroundSize = "cover";
      const title = document.createElement("span");
      title.className = "cover-title";
      title.textContent = item.title || "Untitled";
      const foot = document.createElement("span");
      foot.className = "cover-foot";
      foot.textContent = `${item.genre || "ENTERTAINMENT"} · ${item.release_year || ""}`;
      cover.append(title, foot);
      const info = document.createElement("div");
      info.className = "card-info";
      const text = document.createElement("div");
      const name = document.createElement("b");
      name.textContent = item.title || "Untitled";
      const meta = document.createElement("small");
      meta.textContent = `${item.genre || "Entertainment"} · ${item.type}`;
      text.append(name, meta);
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item.is_premium ? "Premium" : item.type === "series" ? "Series" : "Movie";
      info.append(text, tag);
      article.append(cover, info);
      cards.append(article);
    }
    filterCards();
  } catch {
    // Keep the built-in sample cards visible if the API is not deployed.
  }
})();
