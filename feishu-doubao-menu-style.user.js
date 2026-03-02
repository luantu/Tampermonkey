// ==UserScript==
// @name         豆包 - 自动展开并修改豆包菜单样式
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  自动点击展开菜单，横向排列LI元素，隐藏菜单文字，调整semi-portal-inner位置
// @icon         https://www.google.com/s2/favicons?sz=64&domain=doubao.com
// @author       luantu
// @match        *://*.feishu.cn/*
// @grant        GM_log
// ==/UserScript==

(function () {
    'use strict';
    
    // 使用Tampermonkey的GM_log功能
    function log(message) {
        if (typeof GM_log === 'function') {
            GM_log(message);
        }
    }
    
    // 输出初始日志
    log('豆包菜单样式脚本开始执行');
    log('当前URL: ' + window.location.href);
    
    // 核心函数：等待元素加载并执行操作（移除超时，一直监听直到找到元素）
    function waitForElement(selector, root = document) {
        return new Promise((resolve) => { // 移除reject，只保留resolve
            // 先检查元素是否已存在
            let element = root.querySelector(selector);
            if (element) return resolve(element);

            // 不存在则持续监听 DOM 变化（无超时）
            const observer = new MutationObserver((mutations) => {
                element = root.querySelector(selector);
                if (element) {
                    observer.disconnect(); // 找到元素后停止监听
                    resolve(element);
                }
            });

            // 持续监听根节点的子元素变化（包含所有子树）
            observer.observe(root, { childList: true, subtree: true });
        });
    }

    // 修复：给li设置title（适配动态生成元素+去重+详细日志）
    function setupLiTitleObserver(shadowRoot) {
        function updateLiTitles() {
            const menuItemNames = shadowRoot.querySelectorAll('.menu-item-name');
            log(`【调试】找到.menu-item-name元素数量：${menuItemNames.length}`);

            menuItemNames.forEach(span => {
                const li = span.closest('li');
                if (!li) {
                    log('【调试】未找到.menu-item-name对应的li元素');
                    return;
                }

                const titleText = span.textContent.trim();
                if (!titleText) {
                    log('【调试】.menu-item-name无文本内容');
                    return;
                }

                // 核心优化：检查li是否已有非空title，有则跳过
                const existingTitle = li.getAttribute('title');
                if (existingTitle && existingTitle.trim() === titleText) {
                    return; // 已有相同title，直接跳过
                }

                // 无title/title为空/title不一致时，才设置
                li.setAttribute('title', titleText);
                log(`【调试】✅ 设置title成功：${titleText}，li的class：${li.className}`);
            });
        }

        // 立即执行+监听动态变化
        updateLiTitles();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) updateLiTitles();
            });
        });

        observer.observe(shadowRoot, {
            childList: true,
            subtree: true
        });
        log('【调试】✅ li title监听已启动（含去重逻辑）');
    }

    async function autoShowMenuAndInjectStyle() {
        try {
            // 步骤1：等待并获取shadowHost和shadowRoot
            const shadowHost = await waitForElement('[id*="flow-ext-feishu-toolbar-"]');
            const shadowRoot = shadowHost.shadowRoot || shadowHost;

            // 核心修改1：只要shadowRoot存在，立即注入CSS（无需等待其他元素）
            injectCSS(shadowRoot);
            log('shadowRoot已找到，已优先注入CSS样式');

            // 核心逻辑：持续监控dropdown_icon_container元素的变化
            function monitorDropdownButton() {
                // 查找dropdown_icon_container元素
                const dropdownBtn = shadowRoot.querySelector('[class*="dropdown_icon_container"]');
                
                if (dropdownBtn) {
                    log('找到dropdown_icon_container元素，检查是否需要点击');
                    
                    // 检查是否存在semi-portal-inner
                    const portalInner = shadowRoot.querySelector('.semi-portal-inner');
                    
                    if (!portalInner) {
                        // 如果不存在semi-portal-inner，点击下拉按钮
                        dropdownBtn.click();
                        log('.semi-portal-inner不存在，已点击下拉按钮展开菜单');
                    } else {
                        // 如果存在semi-portal-inner，无需操作
                        log('.semi-portal-inner已存在，无需点击下拉按钮');
                    }
                }
            }
            
            // 首次检查
            monitorDropdownButton();
            
            // 持续监听shadowRoot，当dropdown_icon_container元素出现或变化时检查
            const observer = new MutationObserver((mutations) => {
                log('DOM发生变化，检查dropdown_icon_container元素');
                monitorDropdownButton();
            });
            
            // 监听shadowRoot的所有变化
            observer.observe(shadowRoot, {
                childList: true,
                subtree: true,
                attributes: true
            });
            
            log('已启动持续监听，监控dropdown_icon_container元素的变化');

            setupLiTitleObserver(shadowRoot); // 核心：启动title监听

        } catch (err) {
            log('autoShowMenuAndInjectStyle执行失败: ' + err.message);
        }
    }

    // 注入 CSS 样式到 Shadow Root
    function injectCSS(shadowRoot) {
        if (shadowRoot.querySelector('#custom-menu-style')) return;

        const style = document.createElement('style');
        style.id = 'custom-menu-style';
        style.textContent = `

      /* 1. 最顶层：cici-ext-container 贴合所有子元素宽度 */
      .cici-ext-container {
        position: relative !important; /* 作为所有子元素的定位根节点 */
        width: fit-content !important; /* 关键：宽度贴合子元素（semi-portal的254px） */
        height: fit-content !important; /* 高度也贴合，避免塌陷 */
        display: flex !important; /* 确保宽度由内容决定，而非100% */
      }

      /* 2. 中间层：absolute定位的div 贴合semi-portal宽度 */
      /* 匹配所有包含semi-portal的absolute中间层（可根据实际class调整） */
      .cici-ext-container > div[style*="position: absolute"] {
        position: relative !important; /* 移除绝对定位，回到文档流 */
        top: auto !important; /* 保持原有的垂直位置 */
        right: auto !important; /* 清空right，让它在flex布局中自然排列 */
        width: fit-content !important; /* 宽度贴合内部的semi-portal */
        flex-shrink: 0 !important; /* 防止被压缩 */
      }

      /* 3. 子元素2：doubao_tools_container */
      .doubao_tools_container-BXe6pl {
        flex-shrink: 0 !important; /* 防止被压缩 */
        /* 可根据需要添加margin-left，在两个元素之间留出间距 */
        /* margin-left: 8px !important; */
      }

      /* ########### 核心修复：让semi-portal宽度匹配子元素 ########### */
      /* 3. 重置semi-portal的定位和宽度，使其贴合子元素 */
      .semi-portal {
        position: relative !important; /* 保留作为子元素的定位参考 */
        width: fit-content !important; /* 关键：宽度贴合子元素（254px） */
        height: fit-content !important; /* 高度也贴合子元素，可选 */
        z-index: 1060 !important; /* 保留原有z-index */
        /* 移除所有可能导致宽度为0的属性 */
        left: auto !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
      }

      .semi-portal-inner {
        position: relative !important; /* 改为相对定位，让父元素能捕获其宽度 */
        right: 0 !important; /* 靠右对齐 */
        top: auto !important; /* 垂直位置微调 */
        left: auto !important; /* 清空left */
        transform: none !important; /* 彻底移除translate，避免宽度/位置异常 */
        width: 100% !important; /* 子元素宽度继承父元素（fit-content） */
      }

      /* 1. 菜单横向排列 */
      .semi-tooltip-content > .semi-dropdown-menu {
        display: flex !important;
        flex-wrap: wrap !important;
        list-style: none !important;
        padding: 0px 0px !important;
        margin: 0 !important;
        background: #fff !important;
        border: 0px solid #eee !important;
        border-radius: 0px !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
      }

      .semi-dropdown-item {
        display: flex !important;
        align-items: center !important;
        padding: 8px 5px !important;
        margin: 0 4px !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        height: 28px !important;
      }

      /* 2. 隐藏 menu-item-name 文字 */
      .menu-item-name {
        display: none !important;
      }
      /* 可选：悬浮高亮 */
      .semi-dropdown-item:hover {
        background-color: #f5f5f5 !important;
        border-radius: 4px !important;
      }

      [class*="dropdownItem"] {
          min-width: 10px !important;
      }

      .semi-dropdown-wrapper-show {
        opacity: 1;
        padding: 0px !important;
        border-top-left-radius: 0px !important;
        border-bottom-left-radius: 0px !important;
        border-radius: 6px !important;
        box-shadow: none !important;
      }

      .semi-divider.semi-divider-horizontal {
          display: none !important;
      }

      .semi-tooltip-content > ul:nth-of-type(2) {
           display: none !important;
      }

      /* 润色语气 */
      .semi-tooltip-content > ul:nth-of-type(1) > li:nth-of-type(5) {
           display: none !important;
      }

      /* 精准定位：.menu-item-icon 直接子元素中，class以img-wrapper-开头的span */
      .menu-item-icon > span[class^="img-wrapper-"] {
        width: 16px !important;
        height: 16px !important;
        /* 可选：锁定尺寸，防止被其他样式篡改 */
        min-width: 16px !important;
        max-width: 16px !important;
        min-height: 16px !important;
        max-height: 16px !important;
      }
      
      /* 自定义title气泡样式 */
      .semi-dropdown-item {
        position: relative !important;
        z-index: 1000 !important;
      }
      
      .semi-dropdown-item:hover::before {
        content: attr(title) !important;
        position: absolute !important;
        bottom: 100% !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background-color: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        white-space: nowrap !important;
        z-index: 99999 !important;
        margin-bottom: 8px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        pointer-events: none !important;
      }
      
      .semi-dropdown-item:hover::after {
        content: '' !important;
        position: absolute !important;
        bottom: 100% !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        border-width: 5px !important;
        border-style: solid !important;
        border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent !important;
        margin-bottom: -10px !important;
        z-index: 99998 !important;
        pointer-events: none !important;
      }
      
      /* 确保气泡不会被父元素遮挡 */
      .semi-dropdown-menu {
        overflow: visible !important;
        z-index: 1000 !important;
      }
      
      .semi-tooltip-content {
        overflow: visible !important;
        z-index: 1000 !important;
      }


    `;
        shadowRoot.appendChild(style);
        log('CSS 样式已注入 Shadow DOM');
    }

    // 执行主逻辑
    try {
        log('开始执行autoShowMenuAndInjectStyle函数');
        autoShowMenuAndInjectStyle();
        log('autoShowMenuAndInjectStyle函数执行完成');
    } catch (err) {
        log('执行主逻辑失败: ' + err.message);
    }
    
    // 添加一个定时器，确保脚本完全执行
    setTimeout(() => {
        log('脚本执行完成（定时器）');
    }, 2000);
})();