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

  /*
   * 최초 random 배치와 viewport 설정 과정은 숨깁니다.
   * viewport가 결정된 뒤 그래프를 표시하고 Cola 애니메이션을 실행합니다.
   */
  container.style.visibility = "hidden";

  const cy = cytoscape({
    container,

    elements: [...graphData.nodes, ...graphData.edges],

    minZoom: 0.35,
    maxZoom: 2.5,
    wheelSensitivity: 0.18,

    /*
     * 최초 임시 위치입니다.
     * 실제 물리 배치는 아래 prepareViewportAndRunPhysics()에서 실행합니다.
     */
    layout: {
      name: "random",
      fit: false,
      animate: false,
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

          color: "#1f1f1f",

          "text-background-color": "#ffffff",
          "text-background-opacity": 0.9,
          "text-background-padding": 3,
          "text-background-shape": "roundrectangle",
        },
      },

      /*
       * 중심 노드
       *
       * 실제 글자색은 applyTheme()에서 현재 테마에 맞게 갱신합니다.
       */
      {
        selector: "node.root-node",
        style: {
          width: 55,
          height: 55,

          label: "data(label)",

          "font-size": 13,
          "font-weight": 700,

          color: "#111827",

          "text-valign": "center",
          "text-halign": "center",
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

      // Hover된 세부 토픽만 라벨을 표시합니다.
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

      // 선택된 세부 토픽도 라벨을 표시합니다.
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
          "background-color": "#0a369d",
        },
      },
      {
        selector: 'node[category = "network"]',
        style: {
          "background-color": "#0077b6",
        },
      },
      {
        selector: 'node[category = "aerospace"]',
        style: {
          "background-color": "#00b4d8",
        },
      },
      {
        selector: 'node[category = "quantum"]',
        style: {
          "background-color": "#90e0ef",
        },
      },
      {
        selector: 'node[category = "optimization"]',
        style: {
          "background-color": "#caf0f8",
        },
      },

      // 기본 edge
      {
        selector: "edge",
        style: {
          width: 1,
          opacity: 0.42,

          "curve-style": "bezier",
          "line-color": "#7a828a",
        },
      },

      // 강조된 edge
      {
        selector: "edge.highlighted",
        style: {
          width: 2.2,
          opacity: 0.95,
          "line-color": "#495057",
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
   * 나머지 노드는 세부 토픽으로 처리합니다.
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

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const darkSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  let physicsLayout = null;
  let stagingLayout = null;
  let stopTimer = null;

  /*
   * 이전 레이아웃의 stop 콜백이 새 레이아웃에 영향을 주는 것을
   * 방지하기 위한 실행 번호입니다.
   */
  let layoutRunId = 0;

  /*
   * 공통 Cola 물리 레이아웃 옵션입니다.
   *
   * fit은 항상 false로 유지합니다.
   * 따라서 물리 시뮬레이션 종료 시 viewport가 갑자기 바뀌지 않습니다.
   */
  const physicsOptions = {
    name: "cola",

    animate: true,
    fit: false,

    avoidOverlap: true,
    handleDisconnected: true,

    nodeDimensionsIncludeLabels: false,

    refresh: 1,
    convergenceThreshold: 0.01,

    centerGraph: false,
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

  /*
   * Cola 물리 시뮬레이션을 실행합니다.
   *
   * 여기서는 cy.fit()을 호출하지 않습니다.
   * 사용자가 보고 있는 zoom과 pan을 그대로 유지합니다.
   */
  function runPhysics({ infinite = false, maxSimulationTime = 1600, randomize = false } = {}) {
    const currentRunId = ++layoutRunId;

    stagingLayout?.stop();
    physicsLayout?.stop();

    const prefersReducedMotion = reducedMotionQuery.matches;

    const shouldRunInfinitely = infinite && !prefersReducedMotion;

    const layoutOptions = {
      ...physicsOptions,

      animate: !prefersReducedMotion,
      infinite: shouldRunInfinitely,
      randomize,

      stop: () => {
        /*
         * 새로운 레이아웃이 이미 시작됐다면
         * 이전 레이아웃의 stop 콜백을 무시합니다.
         */
        if (currentRunId !== layoutRunId) {
          return;
        }

        /*
         * 의도적으로 아무것도 하지 않습니다.
         *
         * 기존 코드의 cy.fit()이 여기에 있었기 때문에
         * 애니메이션이 끝날 때 갑자기 zoom-out됐습니다.
         */
      },
    };

    if (!shouldRunInfinitely) {
      layoutOptions.maxSimulationTime = maxSimulationTime;
    }

    physicsLayout = cy.layout(layoutOptions);
    physicsLayout.run();
  }

  /*
   * 최초 viewport를 준비한 뒤 Cola 애니메이션을 실행합니다.
   *
   * 처리 순서:
   * 1. 그래프를 숨긴 상태로 random 배치
   * 2. random 배치를 기준으로 viewport를 한 번만 fit
   * 3. 그래프 표시
   * 4. Cola 물리 애니메이션 실행
   * 5. Cola 종료 시에는 fit하지 않음
   */
  function prepareViewportAndRunPhysics({ maxSimulationTime = 1600 } = {}) {
    const currentRunId = ++layoutRunId;

    window.clearTimeout(stopTimer);

    stagingLayout?.stop();
    physicsLayout?.stop();

    container.style.visibility = "hidden";

    stagingLayout = cy.layout({
      name: "random",

      animate: false,
      fit: false,

      padding: 45,

      stop: () => {
        if (currentRunId !== layoutRunId) {
          return;
        }

        /*
         * random 위치가 만들어진 시점에 viewport를 미리 고정합니다.
         * container가 숨겨져 있으므로 사용자는 이 zoom 변경을 보지 않습니다.
         */
        cy.resize();
        cy.fit(cy.elements(), 45);

        requestAnimationFrame(() => {
          if (currentRunId !== layoutRunId) {
            return;
          }

          /*
           * viewport가 준비된 상태에서 그래프를 표시합니다.
           */
          container.style.visibility = "visible";

          requestAnimationFrame(() => {
            if (currentRunId !== layoutRunId) {
              return;
            }

            /*
             * 화면에 표시된 후 Cola를 실행하므로
             * Obsidian처럼 노드가 움직이는 과정을 볼 수 있습니다.
             */
            runPhysics({
              infinite: false,
              maxSimulationTime,
              randomize: false,
            });
          });
        });
      },
    });

    stagingLayout.run();
  }

  /*
   * 최초 로딩입니다.
   *
   * viewport는 Cola 실행 전에 한 번만 맞추고,
   * Cola가 끝날 때는 viewport를 변경하지 않습니다.
   */
  prepareViewportAndRunPhysics({
    maxSimulationTime: 1600,
  });

  /*
   * 노드를 잡으면 물리 엔진을 무한 실행합니다.
   * 연결된 노드들이 용수철처럼 반응합니다.
   */
  cy.on("grab", "node", () => {
    window.clearTimeout(stopTimer);

    if (reducedMotionQuery.matches) {
      return;
    }

    runPhysics({
      infinite: true,
      randomize: false,
    });
  });

  /*
   * 노드를 놓은 뒤 700ms 동안 움직이게 한 다음 정지합니다.
   *
   * 정지할 때 fit하지 않으므로 zoom과 pan은 바뀌지 않습니다.
   */
  cy.on("free", "node", () => {
    window.clearTimeout(stopTimer);

    stopTimer = window.setTimeout(() => {
      physicsLayout?.stop();
    }, 700);
  });

  /*
   * 세부 토픽은 hover할 때만 라벨을 표시합니다.
   */
  cy.on("mouseover", "node.topic-node", (event) => {
    event.target.addClass("hovered");
  });

  cy.on("mouseout", "node.topic-node", (event) => {
    event.target.removeClass("hovered");
  });

  const description = document.getElementById("interest-description");

  /*
   * 노드를 선택하면 해당 노드와 인접 관계만 강조합니다.
   */
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

  /*
   * 빈 공간을 클릭하면 선택과 강조를 해제합니다.
   */
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
   * CSS 변수 값을 읽습니다.
   */
  function getCssVariable(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    return value || fallback;
  }

  /*
   * 현재 사이트 테마를 판별합니다.
   */
  function isDarkTheme() {
    const html = document.documentElement;
    const body = document.body;

    const htmlTheme = String(html.dataset.theme || "").toLowerCase();

    const bodyTheme = String(body.dataset.theme || "").toLowerCase();

    if (htmlTheme === "dark" || bodyTheme === "dark") {
      return true;
    }

    if (htmlTheme === "light" || bodyTheme === "light") {
      return false;
    }

    if (html.classList.contains("dark") || body.classList.contains("dark")) {
      return true;
    }

    return darkSchemeQuery.matches;
  }

  /*
   * 현재 테마에 맞춰 Cytoscape canvas 색상을 갱신합니다.
   */
  function applyTheme() {
    const isDark = isDarkTheme();

    const textColor = getCssVariable("--global-text-color", isDark ? "#f1f3f5" : "#1f1f1f");

    const backgroundColor = getCssVariable("--global-bg-color", isDark ? "#1c1c1d" : "#ffffff");

    /*
     * al-folio의 --global-divider-color는 다크 모드에서
     * 너무 어두울 수 있으므로 그래프 전용 색상을 사용합니다.
     */
    const edgeColor = getCssVariable("--interest-graph-edge-color", isDark ? "#b8c0c8" : "#7a828a");

    const highlightedEdgeColor = getCssVariable("--interest-graph-highlighted-edge-color", isDark ? "#f1f3f5" : "#495057");

    /*
     * 중심 노드 글자색입니다.
     *
     * 라이트 모드에서는 어두운 색,
     * 다크 모드에서는 흰색을 사용합니다.
     */
    const rootTextColor = getCssVariable("--interest-graph-root-text-color", isDark ? "#ffffff" : "#111827");

    const selectionBorderColor = getCssVariable("--interest-graph-selection-border-color", isDark ? "#ffffff" : "#212529");

    cy.style()
      .selector("node")
      .style({
        color: textColor,
        "text-background-color": backgroundColor,
        "text-outline-color": backgroundColor,
      })
      .selector("node.root-node")
      .style({
        color: rootTextColor,
        "text-background-opacity": 0,
        "border-color": selectionBorderColor,
      })
      .selector("node.topic-node:selected")
      .style({
        "border-color": selectionBorderColor,
      })
      .selector("node.highlighted")
      .style({
        "border-color": selectionBorderColor,
      })
      .selector("edge")
      .style({
        "line-color": edgeColor,
        opacity: isDark ? 0.62 : 0.42,
      })
      .selector("edge.highlighted")
      .style({
        "line-color": highlightedEdgeColor,
        opacity: 0.95,
      })
      .update();
  }

  applyTheme();

  /*
   * al-folio가 HTML 또는 body의 class/data-theme를 변경하면
   * Cytoscape 색상도 다시 계산합니다.
   */
  const themeObserver = new MutationObserver(() => {
    applyTheme();
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });

  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });

  /*
   * 사이트가 data-theme를 사용하지 않는 경우를 위해
   * 운영체제 테마 변경도 감지합니다.
   */
  if (typeof darkSchemeQuery.addEventListener === "function") {
    darkSchemeQuery.addEventListener("change", applyTheme);
  } else {
    // 구형 Safari 호환
    darkSchemeQuery.addListener(applyTheme);
  }

  /*
   * 탭을 벗어나면 물리 연산과 예약된 정지를 중단합니다.
   */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      return;
    }

    window.clearTimeout(stopTimer);

    stagingLayout?.stop();
    physicsLayout?.stop();
  });

  /*
   * Reset:
   *
   * 다시 random 배치한 뒤 viewport를 먼저 고정하고,
   * Cola 애니메이션을 화면에 표시합니다.
   *
   * Cola 종료 후에는 fit하지 않습니다.
   */
  document.getElementById("interest-graph-reset")?.addEventListener("click", () => {
    window.clearTimeout(stopTimer);

    cy.elements().unselect();
    cy.elements().removeClass("faded highlighted");

    prepareViewportAndRunPhysics({
      maxSimulationTime: 1600,
    });

    if (description) {
      description.textContent = "Select a node to view its description.";
    }
  });

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
});
