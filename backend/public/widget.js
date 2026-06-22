(function() {
  // Global SDK definition
  window.ChatAgentive = {
    init: function(options) {
      const apiHost = options.apiHost || window.location.origin;
      const agentKey = options.agentKey;
      if (!agentKey) {
        console.error('Chatagentive: agentKey required');
        return;
      }
      
      const configUrl = `${apiHost}/api/agents/${agentKey}/config`;
      const chatUrl = `${apiHost}/api/agents/${agentKey}/chat`;

      fetch(configUrl)
        .then(res => res.json())
        .then(data => {
          if (data && data.branding) {
            setupWidget(apiHost, chatUrl, data.name, data.branding);
          }
        })
        .catch(err => console.error('Chatagentive: Failed to load configuration', err));
    }
  };

  // Auto-init fallback if loaded via simple script tag with data-chatbot-id
  document.addEventListener('DOMContentLoaded', () => {
    const scriptTag = document.querySelector('script[data-chatbot-id]');
    if (scriptTag) {
      const chatbotId = scriptTag.getAttribute('data-chatbot-id');
      const apiHost = window.location.origin;
      const configUrl = `${apiHost}/api/chatbots/${chatbotId}/embed-config`;
      const chatUrl = `${apiHost}/api/chatbots/${chatbotId}/chat`;

      fetch(configUrl)
        .then(res => res.json())
        .then(data => {
          if (data && data.branding) {
            setupWidget(apiHost, chatUrl, data.name, data.branding);
          }
        })
        .catch(err => console.warn('Chatagentive: Auto-init failed', err));
    }
  });

  // Main setup function using Shadow DOM
  function setupWidget(apiHost, chatUrl, botName, branding) {
    // Prevent duplicate widgets
    if (document.getElementById('chatagentive-widget-host')) return;

    function hexToRgb(hex) {
      if (!hex) return '255, 90, 121';
      var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
      });
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 90, 121';
    }

    const primaryColor = branding.primaryColor || '#ff5a79';
    const bubbleColor = branding.bubbleColor || '#3b82f6';
    const primaryColorRgb = hexToRgb(primaryColor);

    const host = document.createElement('div');
    host.id = 'chatagentive-widget-host';
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style.right = '24px';
    host.style.zIndex = '999999';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Styles
    const style = document.createElement('style');
    style.textContent = `
      :host {
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        --primary-color: ${primaryColor};
        --primary-color-rgb: ${primaryColorRgb};
        --bubble-color-1: ${primaryColor};
        --bubble-color-2: ${bubbleColor};
      }

      /* Bubble Trigger */
      .bubble {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--bubble-color-1), var(--bubble-color-2));
        box-shadow: 0 4px 20px rgba(var(--primary-color-rgb), 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .bubble:hover {
        transform: scale(1.1) rotate(5deg);
        box-shadow: 0 6px 24px rgba(var(--primary-color-rgb), 0.5);
      }
      .bubble svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      /* Chat Window */
      .window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 380px;
        height: 520px;
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      /* Header */
      .header {
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .header-title {
        font-weight: 700;
        color: #f3f4f6;
        font-size: 16px;
      }
      .header-subtitle {
        font-size: 12px;
        color: #9ca3af;
      }
      .close-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 20px;
        transition: color 0.2s;
      }
      .close-btn:hover {
        color: #f3f4f6;
      }

      /* Messages */
      .messages {
        flex-grow: 1;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #0b0f19;
      }
      .msg {
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.5;
        animation: fadeIn 0.3s ease forwards;
        box-sizing: border-box;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .msg.user {
        align-self: flex-end;
        background: var(--primary-color);
        color: white;
        border-bottom-right-radius: 4px;
      }
      .msg.bot {
        align-self: flex-start;
        background: #1e293b;
        color: #e2e8f0;
        border-bottom-left-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .msg.kb-source {
        border-left: 3px solid #10b981;
      }
      .msg.ai-source {
        border-left: 3px solid #3b82f6;
      }

      .badge {
        display: inline-flex;
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .badge.ai {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
      }

      .citation {
        margin-top: 8px;
        font-size: 11px;
        color: #9ca3af;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 6px;
      }

      /* Input */
      .input-area {
        padding: 16px;
        background: #0f172a;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        gap: 8px;
        box-sizing: border-box;
      }
      .input {
        flex-grow: 1;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 10px 14px;
        color: white;
        outline: none;
        font-size: 14px;
        box-sizing: border-box;
      }
      .input:focus {
        border-color: var(--primary-color);
      }
      .send-btn {
        background: var(--primary-color);
        border: none;
        border-radius: 8px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
      }
      .send-btn:hover {
        filter: brightness(0.9);
      }
      .send-btn svg {
        width: 18px;
        height: 18px;
        fill: white;
      }

      /* Typing */
      .typing {
        display: flex;
        gap: 4px;
        padding: 6px 10px;
        align-self: flex-start;
      }
      .dot {
        width: 6px;
        height: 6px;
        background: #9ca3af;
        border-radius: 50%;
        animation: typeDot 1s infinite alternate;
      }
      .dot:nth-child(2) { animation-delay: 0.2s; }
      .dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes typeDot {
        from { transform: translateY(0); }
        to { transform: translateY(-5px); }
      }
    `;
    shadow.appendChild(style);

    const icons = {
      chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
      robot: '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2v1.07A8.99 8.99 0 0 1 21 14v1a3 3 0 0 1-3 3h-1.07a8.99 8.99 0 0 1-9.86 0H6a3 3 0 0 1-3-3v-1a8.99 8.99 0 0 1 7-8.93V4a2 2 0 0 1 2-2zm2 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
      support: '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l2.79-2.79C9.93 18.68 10.95 19 12 19c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/></svg>',
      academic: '<svg viewBox="0 0 24 24"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>'
    };

    const iconKey = branding.chatbotIcon || 'chat';
    let iconContentHtml = '';
    if (icons[iconKey]) {
      iconContentHtml = icons[iconKey];
    } else {
      iconContentHtml = `<span style="font-size: 26px; line-height: 1;">${iconKey}</span>`;
    }

    const widget = document.createElement('div');
    widget.innerHTML = `
      <div class="bubble" id="trigger">
        ${iconContentHtml}
      </div>

      <div class="window" id="window">
        <div class="header">
          <div>
            <div class="header-title">${branding.widgetTitle || botName}</div>
            <div class="header-subtitle">${branding.welcomeText || 'Online'}</div>
          </div>
          <button class="close-btn" id="close">&times;</button>
        </div>
        <div class="messages" id="messages"></div>
        <div class="input-area">
          <input type="text" class="input" id="text" placeholder="Tulis pesan..." autocomplete="off">
          <button class="send-btn" id="send">
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    shadow.appendChild(widget);

    // Bindings
    const trigger = shadow.getElementById('trigger');
    const win = shadow.getElementById('window');
    const close = shadow.getElementById('close');
    const send = shadow.getElementById('send');
    const textInput = shadow.getElementById('text');
    const msgsBox = shadow.getElementById('messages');

    trigger.addEventListener('click', () => {
      win.classList.toggle('open');
      if (win.classList.contains('open') && msgsBox.children.length === 0) {
        addMessage(branding.greetingMessage || 'Halo!', false);
      }
      textInput.focus();
    });

    close.addEventListener('click', () => {
      win.classList.remove('open');
    });

    send.addEventListener('click', sendMsg);
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMsg();
    });

    function addMessage(text, isUser = false, sourceInfo = null) {
      const msg = document.createElement('div');
      msg.classList.add('msg', isUser ? 'user' : 'bot');
      
      if (!isUser && sourceInfo) {
        if (sourceInfo.source === 'knowledge_base') {
          msg.classList.add('kb-source');
          msg.innerHTML = `
            <div class="badge">📚 PDF Resource</div>
            <div>${text}</div>
            <div class="citation">📄 Sumber: <strong>${sourceInfo.filename}</strong> (Hal. ${sourceInfo.pageNumber})</div>
          `;
        } else if (sourceInfo.source === 'ai_llm') {
          msg.classList.add('ai-source');
          
          let badgeText = '🤖 AI Model';
          if (sourceInfo.filename) {
            msg.innerHTML = `
              <div class="badge ai">🤖 AI RAG RESPOND</div>
              <div>${text}</div>
              <div class="citation">📄 Referensi PDF: <strong>${sourceInfo.filename}</strong> (Hal. ${sourceInfo.pageNumber})</div>
            `;
          } else {
            msg.innerHTML = `
              <div class="badge ai">${badgeText}</div>
              <div>${text}</div>
            `;
          }
        }
      } else {
        msg.innerText = text;
      }

      msgsBox.appendChild(msg);
      msgsBox.scrollTop = msgsBox.scrollHeight;
    }

    function addTyping() {
      const div = document.createElement('div');
      div.id = 'typing-indicator';
      div.classList.add('typing');
      div.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
      msgsBox.appendChild(div);
      msgsBox.scrollTop = msgsBox.scrollHeight;
    }

    function removeTyping() {
      const div = shadow.getElementById('typing-indicator');
      if (div) div.remove();
    }

    function sendMsg() {
      const val = textInput.value.trim();
      if (!val) return;

      addMessage(val, true);
      textInput.value = '';

      addTyping();

      fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: val })
      })
      .then(res => res.json())
      .then(data => {
        removeTyping();
        if (data.found) {
          addMessage(data.response, false, {
            source: data.source,
            filename: data.filename,
            pageNumber: data.pageNumber
          });
        } else {
          addMessage(data.response || branding.fallbackMessage || 'Maaf, saya tidak mengerti');
        }
      })
      .catch(err => {
        removeTyping();
        addMessage('Terjadi kesalahan koneksi.');
      });
    }
  }
})();
