document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("interest-graph");

  if (!container || typeof cytoscape === "undefined") {
    return;
  }

  let graphData;

  try {
    graphData = JSON.parse(container.dataset.elements);
  } catch (error) {
    console.error("Failed to parse interest graph data:", error);
    return;
  }

  const cy = cytoscape({
    container,

    elements: [...graphData.nodes, ...graphData.edges],

    minZoom: 0.4,
    maxZoom: 2.5,
    wheelSensitivity: 0.2,

    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          width: 38,
          height: 38,
          "font-size": 11,
          "text-wrap": "wrap",
          "text-max-width": 110,
          "text-valign": "bottom",
          "text-margin-y": 8,
          "background-color": "#6c757d",
        },
      },
      {
        selector: 'node[category = "root"]',
        style: {
          width: 70,
          height: 70,
          "font-size": 15,
          "font-weight": "bold",
          "background-color": "#0076df",
        },
      },
      {
        selector: 'node[category = "ai"]',
        style: {
          "background-color": "#9c27b0",
        },
      },
      {
        selector: 'node[category = "network"]',
        style: {
          "background-color": "#009688",
        },
      },
      {
        selector: 'node[category = "aerospace"]',
        style: {
          "background-color": "#ff9800",
        },
      },
      {
        selector: 'node[category = "quantum"]',
        style: {
          "background-color": "#3f51b5",
        },
      },
      {
        selector: 'node[category = "optimization"]',
        style: {
          "background-color": "#e91e63",
        },
      },
      {
        selector: "edge",
        style: {
          width: 1.5,
          opacity: 0.55,
          "line-color": "#adb5bd",
          "curve-style": "bezier",
        },
      },
      {
        selector: ".faded",
        style: {
          opacity: 0.12,
        },
      },
      {
        selector: ".highlighted",
        style: {
          opacity: 1,
          "border-width": 3,
          "border-color": "#ffffff",
        },
      },
    ],

    layout: {
      name: "cose",
      animate: true,
      fit: true,
      padding: 40,
      idealEdgeLength: 110,
      nodeRepulsion: 6500,
      gravity: 0.25,
    },
  });

  const description = document.getElementById("interest-description");

  cy.on("tap", "node", (event) => {
    const node = event.target;
    const neighborhood = node.closedNeighborhood();

    cy.elements().addClass("faded");
    neighborhood.removeClass("faded");
    node.addClass("highlighted");

    if (description) {
      description.innerHTML = `
        <h3>${escapeHtml(node.data("label"))}</h3>
        <p>${escapeHtml(node.data("description") || "")}</p>
      `;
    }
  });

  cy.on("tap", (event) => {
    if (event.target !== cy) {
      return;
    }

    cy.elements().removeClass("faded highlighted");
  });

  document.getElementById("interest-graph-reset")?.addEventListener("click", () => {
    cy.elements().removeClass("faded highlighted");
    cy.fit(undefined, 40);

    if (description) {
      description.textContent = "Select a node to view its description.";
    }
  });

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
});
