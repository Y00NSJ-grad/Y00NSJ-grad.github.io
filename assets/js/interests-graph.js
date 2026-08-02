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

    minZoom: 0.35,
    maxZoom: 2.5,
    wheelSensitivity: 0.18,

    // Cola 레이아웃을 시작하기 전 임시 위치를 생성합니다.
    layout: {
      name: "random",
      fit: false,
    },

    style: [
      {
        selector: "node",
        style: {
          width: 16,
          height: 16,
          label: "",
          "background-color": "#6c757d",
          "border-width": 0,

          "font-size": 9,
          "font-weight": 400,
          "text-wrap": "wrap",
          "text-max-width": 100,
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 7,

          "text-background-opacity": 0.9,
          "text-background-padding": 3,
          "text-background-shape": "roundrectangle",
        },
      },

      // 중심 노드
      {
        selector: "node.root-node",
        style: {
          width: 46,
          height: 46,
          label: "data(label)",
          "font-size": 13,
          "font-weight": 700,
          color: "#ffffff",
          "text-valign": "center",
          "text-margin-y": 0,
          "text-max-width": 70,
          "text-background-opacity": 0,
          "background-color": "#0879df",
          "border-width": 3,
          "border-color": "#ffffff",
        },
      },

      // 상위 카테고리 노드
      {
        selector: "node.category-node",
        style: {
          width: 24,
          height: 24,
          label: "data(label)",
          "font-size": 10,
          "font-weight": 600,
          "text-max-width": 125,
        },
      },

      // 세부 토픽은 기본적으로 라벨을 숨깁니다.
      {
        selector: "node.topic-node",
        style: {
          width: 14,
          height: 14,
          label: "",
        },
      },

      // hover된 세부 토픽만 라벨 표시
      {
        selector: "node.topic-node.hovered",
        style: {
          width: 19,
          height: 19,
          label: "data(label)",
          "font-size": 10,
          "font-weight": 600,
          "text-max-width": 135,
          "z-index": 999,
        },
      },

      // 선택된 세부 토픽도 라벨 표시
      {
        selector: "node.topic-node:selected",
        style: {
          width: 21,
          height: 21,
          label: "data(label)",
          "font-size": 10,
          "font-weight": 600,
          "text-max-width": 135,
          "border-width": 3,
          "border-color": "#ffffff",
          "z-index": 1000,
        },
      },

      // 카테고리별 색상
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
          "background-color": "#ff9100",
        },
      },
      {
        selector: 'node[category = "quantum"]',
        style: {
          "background-color": "#4054b2",
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
          width: 1,
          opacity: 0.35,
          "curve-style": "bezier",
          "line-color": "#adb5bd",
        },
      },

      {
        selector: "edge.highlighted",
        style: {
          width: 2.2,
          opacity: 0.9,
        },
      },

      {
        selector: ".faded",
        style: {
          opacity: 0.1,
        },
      },

      {
        selector: "node.highlighted",
        style: {
          opacity: 1,
          "border-width": 3,
          "border-color": "#ffffff",
          "z-index": 1000,
        },
      },
    ],
  });

  /*
   * YAML에서 icon이 있는 노드는 상위 카테고리로 처리합니다.
   * 나머지는 세부 토픽입니다.
   */
  cy.nodes().forEach((node) => {
    if (node.id() === "research-interests") {
      node.addClass("root-node");
    } else if (node.data("icon")) {
      node.addClass("category-node");
    } else {
      node.addClass("topic-node");
    }
  });

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  let physicsLayout;
  let stopTimer;
  let initialFit = true;

  /*
   * 공통 Cola 레이아웃 옵션입니다.
   *
   * 평상시에는 물리 엔진을 중단하고,
   * 사용자가 노드를 드래그할 때만 무한 실행합니다.
   */
  const physicsOptions = {
    name: "cola",
    animate: true,
    fit: false,
    padding: 45,

    avoidOverlap: true,
    handleDisconnected: true,

    // 라벨은 대부분 숨겨져 있으므로 충돌 계산에서 제외합니다.
    nodeDimensionsIncludeLabels: false,

    refresh: 1,
    convergenceThreshold: 0.01,

    // 드래그 중 viewport가 움직이지 않도록 합니다.
    centerGraph: false,

    // 물리 시뮬레이션 도중에도 노드를 드래그할 수 있게 합니다.
    ungrabifyWhileSimulating: false,

    nodeSpacing: (node) => {
      if (node.hasClass("root-node")) {
        return 24;
      }

      if (node.hasClass("category-node")) {
        return 16;
      }

      return 8;
    },

    edgeLength: (edge) => {
      const connectedNodes = edge.connectedNodes();

      if (connectedNodes.filter(".root-node").length > 0) {
        return 125;
      }

      if (connectedNodes.filter(".category-node").length > 0) {
        return 95;
      }

      return 70;
    },
  };

  function runPhysics({
    infinite = false,
    maxSimulationTime = 1200,
    randomize = false,
  } = {}) {
    physicsLayout?.stop();

    const shouldRunInfinitely = infinite && !prefersReducedMotion;

    const layoutOptions = {
      ...physicsOptions,
      infinite: shouldRunInfinitely,
      randomize,

      stop: () => {
        /*
         * 최초 로딩과 Reset 시에만 그래프 전체가 보이도록 맞춥니다.
         * 드래그 후에는 viewport를 변경하지 않습니다.
         */
        if (initialFit) {
          cy.fit(undefined, 45);
          initialFit = false;
        }
      },
    };

    /*
     * infinite 모드가 아닌 경우에만 실행 시간 제한을 설정합니다.
     */
    if (!shouldRunInfinitely) {
      layoutOptions.maxSimulationTime = maxSimulationTime;
    }

    physicsLayout = cy.layout(layoutOptions);
    physicsLayout.run();
  }

  /*
   * 최초 페이지 로딩:
   * 약 1.2초 동안만 배치한 뒤 물리 엔진을 정지합니다.
   */
  runPhysics({
    infinite: false,
    maxSimulationTime: 1200,
    randomize: false,
  });

  /*
   * 노드를 잡으면 물리 엔진을 켭니다.
   * 연결된 노드들이 용수철처럼 반응합니다.
   */
  cy.on("grab", "node", () => {
    window.clearTimeout(stopTimer);

    if (prefersReducedMotion) {
      return;
    }

    runPhysics({
      infinite: true,
      randomize: false,
    });
  });

  /*
   * 노드를 놓은 후 700ms 동안 흔들리게 한 뒤 물리 엔진을 정지합니다.
   */
  cy.on("free", "node", () => {
    window.clearTimeout(stopTimer);

    stopTimer = window.setTimeout(() => {
      physicsLayout?.stop();
    }, 700);
  });

  /*
   * 세부 노드는 hover할 때만 라벨을 표시합니다.
   */
  cy.on("mouseover", "node.topic-node", (event) => {
    event.target.addClass("hovered");
  });

  cy.on("mouseout", "node.topic-node", (event) => {
    event.target.removeClass("hovered");
  });

  /*
   * 노드 선택 시 해당 노드와 주변 관계만 강조합니다.
   */
  const description = document.getElementById("interest-description");

  cy.on("tap", "node", (event) => {
    const node = event.target;
    const neighborhood = node.closedNeighborhood();

    cy.elements().unselect();
    node.select();

    cy.elements().removeClass("highlighted");
    cy.elements().addClass("faded");

    neighborhood.removeClass("faded");
    neighborhood.addClass("highlighted");

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

    cy.elements().unselect();
    cy.elements().removeClass("faded highlighted");

    if (description) {
      description.textContent = "Select a node to view its description.";
    }
  });

  /*
   * al-folio의 CSS 변수를 읽어 Cytoscape canvas의 색상을 갱신합니다.
   */
  function getCssVariable(name, fallback) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();

    return value || fallback;
  }

  function applyTheme() {
    const html = document.documentElement;

    const isDark =
      html.dataset.theme === "dark" ||
      html.classList.contains("dark") ||
      document.body.classList.contains("dark");

    const textColor = getCssVariable(
      "--global-text-color",
      isDark ? "#f1f1f1" : "#1f1f1f",
    );

    const backgroundColor = getCssVariable(
      "--global-bg-color",
      isDark ? "#1c1c1d" : "#ffffff",
    );

    const edgeColor = getCssVariable(
      "--global-divider-color",
      isDark ? "#747474" : "#adb5bd",
    );

    cy.style()
      .selector("node")
      .style({
        color: textColor,
        "text-background-color": backgroundColor,
        "text-outline-color": backgroundColor,
      })
      .selector("node.root-node")
      .style({
        color: "#ffffff",
        "text-background-opacity": 0,
      })
      .selector("edge")
      .style({
        "line-color": edgeColor,
      })
      .update();
  }

  applyTheme();

  const themeObserver = new MutationObserver(applyTheme);

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });

  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });

  /*
   * 탭을 벗어나면 물리 연산과 예약된 정지를 모두 중단합니다.
   * 탭으로 돌아왔을 때 자동으로 재실행하지는 않습니다.
   */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      return;
    }

    window.clearTimeout(stopTimer);
    physicsLayout?.stop();
  });

  /*
   * Reset:
   * 노드 위치를 다시 무작위화하고 약 1.2초 동안 재배치합니다.
   */
  document
    .getElementById("interest-graph-reset")
    ?.addEventListener("click", () => {
      window.clearTimeout(stopTimer);

      cy.elements().unselect();
      cy.elements().removeClass("faded highlighted");

      initialFit = true;

      runPhysics({
        infinite: false,
        maxSimulationTime: 1200,
        randomize: true,
      });

      if (description) {
        description.textContent = "Select a node to view its description.";
      }
    });

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});