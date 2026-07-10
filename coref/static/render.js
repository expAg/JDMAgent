// Rendu de la visualisation : surligne chaque chaîne de coréférence d'une couleur
// et trace des liens (arcs) entre les mentions d'une même chaîne.
(function () {
  const data = JSON.parse(document.getElementById("data").textContent);
  const { tokens, chains } = data;

  // Palette de couleurs distinctes par chaîne
  const COLORS = [
    "#e63946", "#2a9d8f", "#e9c46a", "#457b9d", "#9b5de5",
    "#f4845f", "#43aa8b", "#ff6b9d", "#577590", "#bc6c25",
  ];

  // token index -> { chainId, color, mentionId }
  const tokenChain = {};
  chains.forEach((chain, ci) => {
    const color = COLORS[ci % COLORS.length];
    chain.mentions.forEach((mention, mi) => {
      mention.forEach((ti) => {
        tokenChain[ti] = { chainId: chain.id, color, mentionId: ci + "-" + mi };
      });
    });
  });

  // Construction du texte surligné
  const viz = document.getElementById("viz");
  tokens.forEach((tok) => {
    const info = tokenChain[tok.i];
    const span = document.createElement("span");
    span.textContent = tok.text;
    span.dataset.i = tok.i;
    if (info) {
      span.className = "mention";
      span.dataset.chain = info.chainId;
      span.style.background = info.color + "33"; // teinte légère
      span.style.borderBottom = "2px solid " + info.color;
    }
    viz.appendChild(span);
    if (tok.ws) viz.appendChild(document.createTextNode(tok.ws));
  });

  // Légende : une entrée par chaîne, avec le texte de la 1re mention
  const legend = document.getElementById("legend");
  chains.forEach((chain, ci) => {
    const color = COLORS[ci % COLORS.length];
    const firstTokens = chain.mentions[0].map((ti) => tokens[ti].text).join(" ");
    const label = chain.label || firstTokens;
    const item = document.createElement("span");
    item.className = "legend-item";
    item.dataset.chain = chain.id;
    item.innerHTML =
      '<span class="dot" style="background:' + color + '"></span>' +
      "Chaîne " + chain.id + " — « " + label + " » (" +
      chain.mentions.length + " mentions)";
    legend.appendChild(item);
  });

  // Interaction : survol d'une chaîne -> mise en évidence
  function highlight(chainId, on) {
    document.querySelectorAll('.mention[data-chain="' + chainId + '"]')
      .forEach((el) => el.classList.toggle("active", on));
  }
  document.querySelectorAll(".mention").forEach((el) => {
    el.addEventListener("mouseenter", () => highlight(el.dataset.chain, true));
    el.addEventListener("mouseleave", () => highlight(el.dataset.chain, false));
  });
  document.querySelectorAll(".legend-item").forEach((el) => {
    el.addEventListener("mouseenter", () => highlight(el.dataset.chain, true));
    el.addEventListener("mouseleave", () => highlight(el.dataset.chain, false));
  });
})();
