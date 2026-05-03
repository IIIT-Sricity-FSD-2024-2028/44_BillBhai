/**
 * app.js - Main POS application coordinator
 */

document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    try {
        await DataStore.init();
    } catch (error) {
        console.error('POS bootstrap failed, continuing with fallback UI init:', error);
    }

    const session = DataStore.getSessionContext();
    const isCustomerTerminal = Boolean(session.isCustomerTerminal);
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');
    const appLabelEl = document.querySelector('.bc-app');
    const bcPageEl = document.getElementById('bcPage');
    const dropdownTitleEl = document.getElementById('terminalDropdownTitle');
    const dropdownSubtitleEl = document.getElementById('terminalDropdownSubtitle');
    const checkoutStepTitleEl = document.getElementById('checkoutStepTitle');
    const checkoutStepSubtitleEl = document.getElementById('checkoutStepSubtitle');
    const customerStepSubmitBtn = document.getElementById('customerStepSubmitBtn');
    const paymentStepTitleEl = document.getElementById('paymentStepTitle');
    const paymentStepSubtitleEl = document.getElementById('paymentStepSubtitle');
    const goFulfillmentBtn = document.getElementById('btnGoFulfillment');
    const checkoutBtn = document.getElementById('btnCheckout');
    const resetBtn = document.getElementById('btnResetFlow');
    const checkoutModeHeadingEl = document.getElementById('checkoutModeHeading');

    const safeUserName = String(session.userName || 'Cashier').trim() || 'Cashier';
    const displayName = isCustomerTerminal ? 'Self Checkout' : safeUserName;
    const displayAvatar = isCustomerTerminal ? 'S' : safeUserName.charAt(0).toUpperCase();
    const pageLabel = isCustomerTerminal ? 'Self Checkout' : 'Active Customer';

    if (userNameEl) userNameEl.textContent = displayName;
    if (userRoleEl) userRoleEl.textContent = session.businessName;
    if (avatarEl) avatarEl.textContent = displayAvatar;
    if (appLabelEl && session.businessName) appLabelEl.textContent = session.businessName;
    if (bcPageEl) bcPageEl.textContent = pageLabel;
    if (dropdownTitleEl) dropdownTitleEl.textContent = displayName;
    if (dropdownSubtitleEl) dropdownSubtitleEl.textContent = isCustomerTerminal
        ? `${session.businessName} self-checkout lane`
        : `${session.roleLabel} terminal`;

    if (checkoutStepTitleEl) checkoutStepTitleEl.textContent = isCustomerTerminal ? 'Start Self Checkout' : 'Start New Order';
    if (checkoutStepSubtitleEl) checkoutStepSubtitleEl.textContent = isCustomerTerminal
        ? 'Add your details once. Saved shoppers auto-fill when you enter your phone number.'
        : 'Capture customer details first. Existing customers auto-fill when you enter their phone number.';
    if (customerStepSubmitBtn) customerStepSubmitBtn.textContent = isCustomerTerminal ? 'Begin Shopping' : 'Begin Scanning / Manual Entry';
    if (paymentStepTitleEl) paymentStepTitleEl.textContent = isCustomerTerminal ? 'Ready for Payment' : 'Routing to Gateway...';
    if (paymentStepSubtitleEl) paymentStepSubtitleEl.textContent = isCustomerTerminal
        ? 'Your order is prepared. Complete payment to confirm the self-checkout.'
        : 'The payload has been sent successfully. The user chooses Card, UPI, etc., on their device/interface. Webhook triggers upon completion.';
    if (goFulfillmentBtn) goFulfillmentBtn.textContent = isCustomerTerminal
        ? 'Continue to Fulfillment'
        : 'Continue to Fulfillment & Payment';
    if (checkoutModeHeadingEl) checkoutModeHeadingEl.textContent = isCustomerTerminal ? 'How would you like to receive this order?' : 'How should this order go out?';
    if (checkoutBtn) checkoutBtn.textContent = isCustomerTerminal ? 'Proceed to Secure Payment' : 'Proceed to Payment Gateway';
    if (resetBtn) resetBtn.textContent = isCustomerTerminal ? 'Start Another Checkout' : 'Next Customer (Reset POS)';
    if (isCustomerTerminal) document.title = 'BillBhai - Self Checkout';

    UI.setSessionContext(session);

    async function resolveBackendCustomer(dataPayload, companyId, userRole) {
        const customerPayload = dataPayload && dataPayload.customer ? dataPayload.customer : {};
        const normalizedPhone = String(customerPayload.phone || '').replace(/\D/g, '').slice(0, 10);
        const normalizedName = String(customerPayload.name || '').trim();
        const normalizedEmail = String(customerPayload.email || '').trim();
        const normalizedAddress = String(customerPayload.address || '').trim();

        // Company-scoped lookup by phone only (prevents cross-business customer/address bleed).
        if (normalizedPhone) {
            try {
                const scopedResponse = await fetch(`http://localhost:3000/api/customers?companyId=${encodeURIComponent(companyId)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-role': userRole
                    }
                });
                if (scopedResponse.ok) {
                    const scopedRows = await scopedResponse.json();
                    const existing = (Array.isArray(scopedRows) ? scopedRows : []).find((row) => {
                        const rowPhone = String(row && row.mobileNo || '').replace(/\D/g, '').slice(0, 10);
                        return rowPhone && rowPhone === normalizedPhone;
                    });
                    if (existing && existing.id) {
                        const needsUpdate = (
                            (normalizedName && normalizedName !== String(existing.name || '').trim()) ||
                            (normalizedEmail && normalizedEmail !== String(existing.email || '').trim()) ||
                            (normalizedAddress && normalizedAddress !== String(existing.address || '').trim())
                        );
                        if (needsUpdate) {
                            try {
                                const updateResponse = await fetch(`http://localhost:3000/api/customers/${encodeURIComponent(String(existing.id))}`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'x-role': userRole
                                    },
                                    body: JSON.stringify({
                                        name: normalizedName || String(existing.name || '').trim() || 'Walk-in Customer',
                                        email: normalizedEmail,
                                        address: normalizedAddress
                                    })
                                });
                                if (updateResponse.ok) return updateResponse.json();
                            } catch (err) {
                                console.warn('Customer update failed; proceeding with existing customer:', err);
                            }
                        }
                        return existing;
                    }
                }
            } catch (error) {
                console.warn('Scoped customer lookup failed before order submit (continuing):', error);
            }
        }

        try {
            const createResponse = await fetch('http://localhost:3000/api/customers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-role': userRole
                },
                body: JSON.stringify({
                    companyId,
                    name: normalizedName || 'Walk-in Customer',
                    mobileNo: normalizedPhone || `9${Date.now().toString().slice(-9)}`,
                    email: normalizedEmail,
                    address: normalizedAddress
                })
            });

            if (createResponse.ok) return createResponse.json();
            console.warn('Customer create returned non-ok status, falling back to default customer', createResponse.status);
        } catch (err) {
            console.warn('Customer create failed (continuing with fallback):', err);
        }

        // Fallback to a minimal customer record so order creation can continue
        return { id: String(customerPayload.id || 'CUS-001'), name: String(customerPayload.name || 'Walk-in Customer') };
    }

    async function submitOrderToBackend(dataPayload) {
        try {
            const userRole = localStorage.getItem('userRole') || 'cashier';
            const customerPayload = dataPayload && dataPayload.customer ? dataPayload.customer : {};
            const checkoutMode = String(customerPayload.checkoutMode || 'takeaway_now').trim() || 'takeaway_now';
            const orderType = checkoutMode === 'takeaway_now' ? 'pickup' : 'delivery';
            const discountAmount = Math.max(0, Number(dataPayload && dataPayload.discount && dataPayload.discount.discount || 0));
            const paymentMethod = String(customerPayload.paymentMethod || (checkoutMode === 'cod_delivery' ? 'COD' : 'Paid Upfront')).trim() || 'Pending';
            let userId = 'USR-002';
            try {
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                userId = currentUser && currentUser.id ? currentUser.id : userId;
            } catch (err) {
                userId = 'USR-002';
            }

            const companyId = localStorage.getItem('activeBusinessId') || 'BIZ-101';
            const customerRecord = await resolveBackendCustomer(dataPayload, companyId, userRole);

            const backendPayload = {
                customerName: String(customerRecord && customerRecord.name || customerPayload.name || '').trim() || undefined,
                customerId: String(customerRecord && customerRecord.id || customerPayload.id || 'CUS-001').trim() || 'CUS-001',
                staffId: userId,
                companyId,
                orderType,
                checkoutMode,
                discountAmount,
                promoCode: dataPayload.discount && dataPayload.discount.active ? dataPayload.discount.code : undefined,
                paymentMethod,
                items: Array.isArray(dataPayload.cart)
                    ? dataPayload.cart.map(item => ({
                        productId: item.id,
                        quantity: Number(item.qty || item.quantity || 1),
                        itemPrice: item.price
                    }))
                    : []
            };

            const response = await fetch('http://localhost:3000/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-role': userRole
                },
                body: JSON.stringify(backendPayload)
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                console.error('Order create failed', response.status, text);
                throw new Error(`Order create failed with status ${response.status}`);
            }

            const backendOrder = await response.json();

            if (orderType === 'delivery') {
                const deliveryPayload = {
                    orderId: String(backendOrder.id || '').trim(),
                    partnerName: String(customerPayload.deliveryPartner || '').trim() || undefined,
                    partnerPhone: String(customerPayload.deliveryPartnerPhone || '').trim() || undefined,
                    dispatchDate: new Date().toISOString().slice(0, 10),
                    customerName: String(customerPayload.name || (customerRecord && customerRecord.name) || '').trim() || undefined,
                    address: String(customerPayload.address || (customerRecord && customerRecord.address) || '').trim() || undefined
                };
                try {
                    const deliveryResponse = await fetch('http://localhost:3000/api/deliveries', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-role': userRole
                        },
                        body: JSON.stringify(deliveryPayload)
                    });
                    if (!deliveryResponse.ok) {
                        const bodyText = await deliveryResponse.text().catch(() => '');
                        console.warn('Delivery create rejected:', deliveryResponse.status, bodyText);
                    }
                } catch (error) {
                    console.warn('Delivery create failed after order submit:', error);
                }
            }

            const itemCount = Array.isArray(dataPayload.cart)
                ? dataPayload.cart.reduce((sum, item) => sum + Math.max(1, Number(item && (item.qty || item.quantity) || 1)), 0)
                : 0;
            const total = Array.isArray(dataPayload.cart)
                ? dataPayload.cart.reduce((sum, item) => sum + (Math.max(0, Number(item && item.price || 0)) * Math.max(1, Number(item && (item.qty || item.quantity) || 1))), 0)
                : 0;

            const updatePayload = {
                customerName: String(customerRecord && customerRecord.name || customerPayload.name || '').trim(),
                itemsCount: itemCount,
                total: Math.max(0, total - discountAmount + Math.max(0, Number(customerPayload.deliveryCharge || 0))),
                status: String(customerPayload.orderStatus || 'Processing').trim() || 'Processing',
                paymentMethod: String(customerPayload.paymentMethod || paymentMethod || 'Pending').trim() || 'Pending'
            };

            try {
                const updateResponse = await fetch(`http://localhost:3000/api/orders/${encodeURIComponent(String(backendOrder.id))}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-role': userRole
                    },
                    body: JSON.stringify(updatePayload)
                });
                const updateText = await updateResponse.text().catch(() => '');
                let updateJson = null;
                try {
                    updateJson = updateText ? JSON.parse(updateText) : null;
                } catch (error) {
                    updateJson = null;
                }
                console.debug('Order post-create update response:', updateResponse.status, updateJson || updateText);
                if (updateResponse.ok) {
                    return {
                        backendOrder: updateJson || backendOrder,
                        customerRecord
                    };
                }
            } catch (error) {
                console.warn('Order post-create update failed:', error);
            }

            console.debug('Returning initial backendOrder after create:', backendOrder);
            const computedTotal = Array.isArray(dataPayload.cart)
                ? dataPayload.cart.reduce((sum, item) => sum + (Math.max(0, Number(item && item.price || 0)) * Math.max(1, Number(item && (item.qty || item.quantity) || 1))), 0)
                : 0;

            try {
                const listResp = await fetch(`http://localhost:3000/api/orders?companyId=${encodeURIComponent(companyId)}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json', 'x-role': userRole }
                });
                if (listResp.ok) {
                    const listJson = await listResp.json();
                    if (Array.isArray(listJson)) {
                        const now = Date.now();
                        const candidate = listJson.find(o => {
                            const oTotal = Number(o && o.total || 0);
                            const oTime = new Date(o.orderDate || '').getTime() || 0;
                            return Math.abs(oTotal - Math.max(0, computedTotal || 0)) < 0.01 && (now - oTime) < 60000;
                        });
                        if (candidate && candidate.id) {
                            console.debug('Rescue found backend order matching cart total:', candidate.id);
                            return { backendOrder: candidate, customerRecord };
                        }
                    }
                }
            } catch (err) {
                console.warn('Rescue fetch for recent orders failed:', err);
            }

            return { backendOrder, customerRecord };
        } catch (error) {
            console.error('Error submitting order to backend:', error);
            return null;
        }
    }

    UI.setCallbacks({
        onCheckout: async (dataPayload) => {
            const backendResult = await submitOrderToBackend(dataPayload);
            if (!backendResult || !backendResult.backendOrder || !backendResult.backendOrder.id) {
                console.warn('Backend order missing or incomplete, proceeding with local order creation', backendResult);
            }
            const newOrder = DataStore.createOrder(
                dataPayload.customer,
                dataPayload.cart,
                dataPayload.discount,
                {
                    backendOrder: backendResult && backendResult.backendOrder,
                    customerId: backendResult && backendResult.customerRecord && backendResult.customerRecord.id,
                    customerRecord: backendResult && backendResult.customerRecord
                }
            );

            console.log('Simulating gateway redirect for order:', newOrder);
            return newOrder;
        }
    });

    UI.init();

    document.querySelectorAll('a[href=\"login.html\"]').forEach(link => {
        link.addEventListener('click', () => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('userName');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeBusinessId');
            localStorage.removeItem('activeBusinessName');
            sessionStorage.removeItem('bb_customer_session_id');
            sessionStorage.removeItem('bb_customer_session_notifications');
        });
    });
});
