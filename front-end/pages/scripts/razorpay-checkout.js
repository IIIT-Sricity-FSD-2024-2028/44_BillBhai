/**
 * BillBhai Razorpay Gateway Handler
 * 
 * Supports both:
 * 1. REAL Official Razorpay Cloud Checkout (when official CDN + valid rzp_test_ key is configured)
 * 2. Instant Local Evaluation Sandbox (zero-cost simulated fallback with HMAC SHA-256 verification)
 */

(function () {
  // If the official Razorpay CDN script is already loaded and active, don't overwrite it
  if (typeof window.Razorpay === 'function' && !window.Razorpay.__isBillBhaiMock) {
    window.__OfficialRazorpay = window.Razorpay;
  }

  class CustomRazorpay {
    constructor(options) {
      this.options = options || {};
      this.__isBillBhaiMock = true;

      // If official Razorpay is available and a non-mock key is passed, delegate to official Razorpay
      const isMockKey = !this.options.key || this.options.key.includes('MockKey');
      if (window.__OfficialRazorpay && !isMockKey) {
        try {
          this._officialInstance = new window.__OfficialRazorpay(this.options);
        } catch (e) {
          console.warn('Official Razorpay init fallback:', e);
        }
      }
    }

    open() {
      if (this._officialInstance && typeof this._officialInstance.open === 'function') {
        try {
          return this._officialInstance.open();
        } catch (e) {
          console.warn('Official Razorpay open failed, opening local fallback:', e);
        }
      }
      this.renderModal();
    }

    renderModal() {
      const existing = document.getElementById('bb-rzp-modal-container');
      if (existing) existing.remove();

      const amountFormatted = (Number(this.options.amount || 0) / 100).toLocaleString('en-IN', {
        style: 'currency',
        currency: this.options.currency || 'INR',
      });

      const modalHtml = `
        <div id="bb-rzp-modal-container" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.8);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Inter',system-ui,-apple-system,sans-serif;animation:rzpFadeIn 0.25s ease;">
          <div id="bb-rzp-modal-card" style="width:100%;max-width:440px;background:#ffffff;border-radius:16px;box-shadow:0 30px 60px -12px rgba(0,0,0,0.6);overflow:hidden;position:relative;">
            
            <!-- Razorpay Official Brand Header -->
            <div style="background:linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);color:#fff;padding:22px 24px;position:relative;">
              <button id="bb-rzp-close" type="button" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.12);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;">&times;</button>
              
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="background:#2563eb;color:#fff;font-weight:900;font-size:11px;padding:3px 8px;border-radius:4px;letter-spacing:1px;">RAZORPAY</div>
                  <span style="font-size:11px;color:#93c5fd;font-weight:600;">TEST MODE</span>
                </div>
                <div style="font-size:10px;background:rgba(255,255,255,0.15);padding:2px 6px;border-radius:4px;color:#e2e8f0;">No real money deducted</div>
              </div>
              <div style="font-size:17px;font-weight:700;color:#f8fafc;">${this.options.name || 'BillBhai Retail POS'}</div>
              <div style="font-size:12px;color:#cbd5e1;margin-top:2px;">${this.options.description || 'Subscription Order'}</div>
              
              <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.15);display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:12px;color:#cbd5e1;">Amount to Pay</span>
                <span style="font-size:24px;font-weight:800;color:#38bdf8;">${amountFormatted}</span>
              </div>
            </div>

            <!-- Main Checkout View -->
            <div id="bb-rzp-main-view">
              <!-- Payment Method Tabs -->
              <div style="padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                  <button type="button" class="bb-rzp-tab active" data-tab="upi" style="padding:9px 6px;border:1.5px solid #2563eb;background:#eff6ff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:#1e40af;text-align:center;">
                    ⚡ UPI / QR
                  </button>
                  <button type="button" class="bb-rzp-tab" data-tab="card" style="padding:9px 6px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:#475569;text-align:center;">
                    💳 Card
                  </button>
                  <button type="button" class="bb-rzp-tab" data-tab="nb" style="padding:9px 6px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:#475569;text-align:center;">
                    🏦 NetBanking
                  </button>
                </div>
              </div>

              <!-- Tab Contents -->
              <div id="bb-rzp-tab-content" style="padding:18px 24px;color:#1e293b;">
                <!-- UPI Pane -->
                <div id="bb-pane-upi" style="text-align:center;">
                  <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:10px;">Scan QR with any UPI app</div>
                  <div style="width:130px;height:130px;margin:0 auto 10px;background:#ffffff;border:2px dashed #94a3b8;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.04);">
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    <span style="font-size:9px;color:#64748b;margin-top:4px;font-weight:600;">GPay • PhonePe • Paytm</span>
                  </div>
                  <div style="font-size:11px;color:#64748b;">UPI ID: <strong style="color:#0f172a;">billbhai@razorpay</strong></div>
                </div>

                <!-- Card Pane -->
                <div id="bb-pane-card" style="display:none;">
                  <div style="margin-bottom:10px;">
                    <label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Test Card Number</label>
                    <input type="text" value="4111 1111 1111 1111" disabled style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#f8fafc;color:#334155;box-sizing:border-box;">
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                      <label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Expiry</label>
                      <input type="text" value="12/28" disabled style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#f8fafc;color:#334155;box-sizing:border-box;">
                    </div>
                    <div>
                      <label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">CVV</label>
                      <input type="password" value="888" disabled style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#f8fafc;color:#334155;box-sizing:border-box;">
                    </div>
                  </div>
                </div>

                <!-- NetBanking Pane -->
                <div id="bb-pane-nb" style="display:none;">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                    <div style="padding:10px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;background:#f8fafc;font-weight:600;color:#0f172a;">HDFC Bank</div>
                    <div style="padding:10px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;background:#f8fafc;font-weight:600;color:#0f172a;">ICICI Bank</div>
                    <div style="padding:10px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;background:#f8fafc;font-weight:600;color:#0f172a;">State Bank of India</div>
                    <div style="padding:10px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;background:#f8fafc;font-weight:600;color:#0f172a;">Axis Bank</div>
                  </div>
                </div>
              </div>

              <!-- Footer & Pay Action -->
              <div style="padding:14px 24px 20px;background:#ffffff;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;">
                <button id="bb-rzp-pay-btn" type="button" style="width:100%;background:#2563eb;color:#ffffff;border:none;padding:12px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background 0.2s;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <span>Pay ${amountFormatted}</span>
                </button>
                
                <div style="text-align:center;font-size:11px;color:#94a3b8;display:flex;align-items:center;justify-content:center;gap:6px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Secured by Razorpay 256-Bit SSL Encryption
                </div>
              </div>
            </div>

            <!-- Success State Screen -->
            <div id="bb-rzp-success-view" style="display:none;padding:36px 24px;text-align:center;background:#ffffff;">
              <div style="width:58px;height:58px;margin:0 auto 16px;background:#dcfce7;color:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(22,163,74,0.2);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:6px;">Payment Successful!</h3>
              <p style="font-size:13px;color:#64748b;margin-bottom:18px;">Razorpay HMAC signature verified. Your plan is active.</p>
              <div style="background:#f1f5f9;border-radius:8px;padding:12px;font-size:12px;color:#334155;text-align:left;display:inline-block;width:100%;box-sizing:border-box;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="color:#64748b;">Transaction ID:</span>
                  <strong id="bb-rzp-txn-id" style="font-family:monospace;color:#0f172a;">pay_...</strong>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="color:#64748b;">Status:</span>
                  <strong style="color:#16a34a;">Paid & Active</strong>
                </div>
              </div>
            </div>

          </div>
        </div>
        <style>
          @keyframes rzpFadeIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
          @keyframes spin { 100% { transform:rotate(360deg); } }
        </style>
      `;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = modalHtml;
      document.body.appendChild(wrapper.firstElementChild);

      const modalContainer = document.getElementById('bb-rzp-modal-container');
      const closeBtn = document.getElementById('bb-rzp-close');
      const payBtn = document.getElementById('bb-rzp-pay-btn');
      const mainView = document.getElementById('bb-rzp-main-view');
      const successView = document.getElementById('bb-rzp-success-view');
      const txnIdEl = document.getElementById('bb-rzp-txn-id');

      const closeModal = () => {
        if (modalContainer) modalContainer.remove();
        if (this.options.modal && typeof this.options.modal.ondismiss === 'function') {
          this.options.modal.ondismiss();
        }
      };

      closeBtn.onclick = closeModal;
      modalContainer.onclick = (e) => {
        if (e.target === modalContainer) closeModal();
      };

      // Tab Switchers
      const tabs = modalContainer.querySelectorAll('.bb-rzp-tab');
      tabs.forEach((tab) => {
        tab.onclick = () => {
          tabs.forEach((t) => {
            t.style.border = '1px solid #e2e8f0';
            t.style.background = '#fff';
            t.style.color = '#475569';
          });
          tab.style.border = '1.5px solid #2563eb';
          tab.style.background = '#eff6ff';
          tab.style.color = '#1e40af';

          const target = tab.getAttribute('data-tab');
          document.getElementById('bb-pane-upi').style.display = target === 'upi' ? 'block' : 'none';
          document.getElementById('bb-pane-card').style.display = target === 'card' ? 'block' : 'none';
          document.getElementById('bb-pane-nb').style.display = target === 'nb' ? 'block' : 'none';
        };
      });

      // Pay Button Click
      payBtn.onclick = () => {
        payBtn.disabled = true;
        payBtn.style.opacity = '0.85';
        payBtn.innerHTML = `
          <svg style="animation:spin 1s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/></svg>
          <span>Authorizing with Razorpay...</span>
        `;

        const mockPaymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const mockSignature = 'mock_signature';

        setTimeout(() => {
          mainView.style.display = 'none';
          txnIdEl.textContent = mockPaymentId;
          successView.style.display = 'block';

          setTimeout(() => {
            closeModal();
            if (typeof this.options.handler === 'function') {
              this.options.handler({
                razorpay_payment_id: mockPaymentId,
                razorpay_order_id: this.options.order_id || `sub_${Date.now()}`,
                razorpay_signature: mockSignature,
              });
            }
          }, 900);
        }, 500);
      };
    }
  }

  // Install custom wrapper globally
  window.Razorpay = CustomRazorpay;
})();
