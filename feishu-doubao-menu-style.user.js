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

    // 初始化和管理菜单项
    function initializeMenuItems(shadowRoot) {
        // 配置项
        const config = {
            hiddenItems: ['AI 搜索', '调整语气', '复制'], // 要隐藏的菜单项
            sortOrder: [ // 菜单项排序顺序
                '专业中文翻译',
                '朗读',
                '翻译',
                '解释',
                '修正语法',
                '调整语气',
                'AI 搜索',
                '复制'
            ]
        };
        
        // 状态标记
        const state = {
            initialized: false,
            iconReplaced: false,
            menuSorted: false
        };
        
        // 更新菜单项：设置data-title和隐藏指定项
        function updateMenuItems() {
            const menuItemNames = shadowRoot.querySelectorAll('.menu-item-name');
            log(`【调试】找到.menu-item-name元素数量：${menuItemNames.length}`);

            menuItemNames.forEach(span => {
                const li = span.closest('li');
                if (!li) {
                    log('【调试】未找到.menu-item-name对应的li元素');
                    return;
                }

                // 检查是否已经处理过该菜单项
                if (li._menuItemProcessed) {
                    return;
                }

                const titleText = span.textContent.trim();
                if (!titleText) {
                    log('【调试】.menu-item-name无文本内容');
                    li._menuItemProcessed = true;
                    return;
                }

                // 检查是否需要隐藏该li元素
                if (config.hiddenItems.includes(titleText)) {
                    li.setAttribute('style', 'display: none !important;');
                    log(`【调试】✅ 隐藏菜单项：${titleText}`);
                    li._menuItemProcessed = true;
                    return;
                }

                // 移除原生title属性，使用自定义数据属性存储title内容
                li.removeAttribute('title');
                li.setAttribute('data-title', titleText);
                log(`【调试】✅ 设置data-title成功：${titleText}，li的class：${li.className}`);
                li._menuItemProcessed = true;
            });
        }

        // 设置气泡定位
        function setupTooltipPositioning() {
            const menuItems = shadowRoot.querySelectorAll('.semi-dropdown-item');
            menuItems.forEach(item => {
                // 检查是否已经添加过事件监听器
                if (!item._hasTooltipListener) {
                    item.addEventListener('mousemove', (e) => {
                        const rect = item.getBoundingClientRect();
                        const tooltipX = rect.left + rect.width / 2;
                        const tooltipY = rect.top;
                        
                        item.style.setProperty('--tooltip-x', tooltipX + 'px');
                        item.style.setProperty('--tooltip-y', tooltipY + 'px');
                    });
                    item._hasTooltipListener = true;
                }
            });
        }

        // 替换菜单项图标
        function replaceMenuItemIcon() {
            if (state.iconReplaced) return;
            
            // 找到menu-item-name为"翻译"的li元素
            const translateLi = Array.from(shadowRoot.querySelectorAll('.menu-item-name')).find(span => 
                span.textContent.trim() === '翻译'
            )?.closest('li');
            
            // 找到menu-item-name为"专业中文翻译"的li元素
            const professionalTranslateLi = Array.from(shadowRoot.querySelectorAll('.menu-item-name')).find(span => 
                span.textContent.trim() === '专业中文翻译'
            )?.closest('li');
            
            if (translateLi && professionalTranslateLi) {
                const translateIcon = translateLi.querySelector('.menu-item-icon');
                const professionalTranslateIcon = professionalTranslateLi.querySelector('.menu-item-icon');
                
                if (translateIcon && professionalTranslateIcon) {
                    professionalTranslateIcon.innerHTML = translateIcon.innerHTML;
                    log('【调试】✅ 已将"专业中文翻译"的图标替换为"翻译"的图标');
                    state.iconReplaced = true;
                }
            }
        }
        
        // 排序菜单项
        function sortMenuItems() {
            if (state.menuSorted) return;
            
            const ul = shadowRoot.querySelector('.semi-dropdown-menu');
            if (!ul) {
                log('【调试】未找到.semi-dropdown-menu元素');
                return;
            }
            
            const lis = Array.from(ul.querySelectorAll('li'));
            if (lis.length === 0) {
                log('【调试】未找到li元素');
                return;
            }
            
            // 为每个li元素获取menu-item-name文本
            const lisWithNames = lis.map(li => {
                const menuItemName = li.querySelector('.menu-item-name');
                return {
                    li,
                    name: menuItemName ? menuItemName.textContent.trim() : ''
                };
            });
            
            // 按指定顺序排序
            lisWithNames.sort((a, b) => {
                const indexA = config.sortOrder.indexOf(a.name);
                const indexB = config.sortOrder.indexOf(b.name);
                // 不在排序列表中的元素放在最后
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
            
            // 重新排列li元素
            lisWithNames.forEach(({ li }) => {
                ul.appendChild(li);
            });
            
            log('【调试】✅ 已按指定顺序排序菜单项');
            state.menuSorted = true;
        }

        // 初始化函数
        function init() {
            if (state.initialized) return;
            
            updateMenuItems();
            setupTooltipPositioning();
            replaceMenuItemIcon();
            sortMenuItems();
            
            state.initialized = true;
        }

        // 立即执行初始化
        init();
        
        return {
            update: function() {
                updateMenuItems();
                setupTooltipPositioning();
                replaceMenuItemIcon();
                sortMenuItems();
            }
        };
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

            // 初始化菜单项管理
            const menuManager = initializeMenuItems(shadowRoot);
            
            // 持续监听shadowRoot，处理所有变化
            const observer = new MutationObserver((mutations) => {
                // 检查是否有实际的内容变化
                let hasContentChange = false;
                
                mutations.forEach(mutation => {
                    // 检查是否有新节点添加
                    if (mutation.addedNodes.length > 0) {
                        hasContentChange = true;
                    }
                    // 检查是否有节点被移除
                    else if (mutation.removedNodes.length > 0) {
                        hasContentChange = true;
                    }
                    // 检查是否有属性变化
                    else if (mutation.type === 'attributes') {
                        hasContentChange = true;
                    }
                });
                
                if (hasContentChange) {
                    log('DOM内容发生变化，更新菜单状态');
                    monitorDropdownButton();
                    menuManager.update();
                }
            });

            // 监听shadowRoot的所有变化
            observer.observe(shadowRoot, {
                childList: true,
                subtree: true,
                attributes: true
            });

            log('已启动持续监听，监控菜单状态变化');

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

      /* 使用固定定位来突破父元素限制 */
      .semi-dropdown-item:hover::before {
        content: attr(data-title) !important;
        position: fixed !important;
        left: var(--tooltip-x, 100px) !important;
        top: var(--tooltip-y, 100px) !important;
        background-color: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        white-space: nowrap !important;
        z-index: 999999 !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        pointer-events: none !important;
        /* 使用transform定位，再往上移4个px */
        transform: translate(-50%, -100%) !important;
        margin-top: -12px !important;
      }

      /* 确保只有带有data-title属性的元素显示气泡 */
      .semi-dropdown-item:not([data-title]):hover::before,
      .semi-dropdown-item:not([data-title]):hover::after {
        display: none !important;
      }

      .semi-dropdown-item:hover::after {
        content: '' !important;
        position: fixed !important;
        left: var(--tooltip-x, 100px) !important;
        top: var(--tooltip-y, 100px) !important;
        border-width: 5px !important;
        border-style: solid !important;
        border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent !important;
        z-index: 999998 !important;
        pointer-events: none !important;
        /* 使用transform定位 */
        transform: translate(-50%, -100%) !important;
        margin-top: -2px !important;
      }

      /* 确保所有可能的父元素都不会遮挡气泡 */
      .semi-dropdown-menu,
      .semi-tooltip-content,
      .cici-ext-container,
      [class*="dropdown_icon_container"],
      [id*="flow-ext-feishu-toolbar-"] {
        overflow: visible !important;
        z-index: 1000 !important;
        position: relative !important;
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
})();