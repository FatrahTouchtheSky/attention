const fs = require('fs');
const css = `
/* =========================
   OPTIONS MENU
   ========================= */
.options-menu {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: #202124;
    border: 1px solid #5f6368;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    display: none;
    flex-direction: column;
    min-width: 180px;
    z-index: 1000;
    overflow: hidden;
}

.options-menu.show {
    display: flex;
}

.menu-item {
    background: none;
    border: none;
    color: #e8eaed;
    padding: 12px 16px;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 10px;
}

.menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
}
`;
fs.appendFileSync('public/style.css', css, 'utf8');
