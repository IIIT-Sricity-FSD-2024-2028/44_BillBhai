// Port of the checkout backend calls in scripts/app.js
// (customer lookup/create/update, order create + post-create update, delivery).

const API_BASE = 'http://localhost:4000/api';

async function resolveBackendCustomer(dataPayload, companyId, userRole) {
  const customerPayload = dataPayload && dataPayload.customer ? dataPayload.customer : {};
  const normalizedPhone = String(customerPayload.phone || '').replace(/\D/g, '');
  const hasValidPhone = /^\d{10}$/.test(normalizedPhone);
  const normalizedName = String(customerPayload.name || '').trim();
  const normalizedEmail = String(customerPayload.email || '').trim();
  const normalizedAddress = String(customerPayload.address || '').trim();
  const hasEmail = normalizedEmail.length > 0;
  const hasAddress = normalizedAddress.length > 0;

  // Company-scoped lookup by phone only (prevents cross-business customer/address bleed).
  if (hasValidPhone) {
    try {
      const scopedResponse = await fetch(`${API_BASE}/customers?companyId=${encodeURIComponent(companyId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-role': userRole,
        },
      });
      if (scopedResponse.ok) {
        const scopedRows = await scopedResponse.json();
        const existing = (Array.isArray(scopedRows) ? scopedRows : []).find((row) => {
          const rowPhone = String((row && row.mobileNo) || '').replace(/\D/g, '');
          return /^\d{10}$/.test(rowPhone) && rowPhone === normalizedPhone;
        });
        if (existing && existing.id) {
          const needsUpdate = (
            (normalizedName && normalizedName !== String(existing.name || '').trim()) ||
            (normalizedEmail && normalizedEmail !== String(existing.email || '').trim()) ||
            (normalizedAddress && normalizedAddress !== String(existing.address || '').trim())
          );
          if (needsUpdate) {
            try {
              const updateBody = {
                name: normalizedName || String(existing.name || '').trim() || 'Walk-in Customer',
              };
              if (hasEmail) updateBody.email = normalizedEmail;
              if (hasAddress) updateBody.address = normalizedAddress;

              const updateResponse = await fetch(`${API_BASE}/customers/${encodeURIComponent(String(existing.id))}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'x-role': userRole,
                },
                body: JSON.stringify(updateBody),
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
    const createBody = {
      companyId,
      name: normalizedName || 'Walk-in Customer',
      mobileNo: hasValidPhone ? normalizedPhone : `9${Date.now().toString().slice(-9)}`,
    };
    if (hasEmail) createBody.email = normalizedEmail;
    if (hasAddress) createBody.address = normalizedAddress;

    const createResponse = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-role': userRole,
      },
      body: JSON.stringify(createBody),
    });

    if (createResponse.ok) return createResponse.json();
    console.warn('Customer create returned non-ok status, falling back to default customer', createResponse.status);
  } catch (err) {
    console.warn('Customer create failed (continuing with fallback):', err);
  }

  // Fallback to a minimal customer record so order creation can continue
  return { id: String(customerPayload.id || 'CUS-001'), name: String(customerPayload.name || 'Walk-in Customer') };
}

function sumCartQty(cart) {
  return cart.reduce((sum, item) => sum + Math.max(1, Number((item && (item.qty || item.quantity)) || 1)), 0);
}

function sumCartTotal(cart) {
  return cart.reduce((sum, item) => sum + (Math.max(0, Number((item && item.price) || 0)) * Math.max(1, Number((item && (item.qty || item.quantity)) || 1))), 0);
}

export async function submitOrderToBackend(dataPayload) {
  try {
    const userRole = localStorage.getItem('userRole') || 'cashier';
    const customerPayload = dataPayload && dataPayload.customer ? dataPayload.customer : {};
    const checkoutMode = String(customerPayload.checkoutMode || 'takeaway_now').trim() || 'takeaway_now';
    const orderType = checkoutMode === 'takeaway_now' ? 'pickup' : 'delivery';
    const discountAmount = Math.max(0, Number((dataPayload && dataPayload.discount && dataPayload.discount.discount) || 0));
    const paymentMethod = String(customerPayload.paymentMethod || (checkoutMode === 'cod_delivery' ? 'COD' : 'Paid Upfront')).trim() || 'Pending';
    let userId = 'USR-002';
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      userId = currentUser && currentUser.id ? currentUser.id : userId;
    } catch {
      userId = 'USR-002';
    }

    const companyId = localStorage.getItem('activeBusinessId') || 'BIZ-101';
    const customerRecord = await resolveBackendCustomer(dataPayload, companyId, userRole);

    const backendPayload = {
      customerName: String((customerRecord && customerRecord.name) || customerPayload.name || '').trim() || undefined,
      customerAddress: String(customerPayload.address || '').trim() || undefined,
      customerId: String((customerRecord && customerRecord.id) || customerPayload.id || 'CUS-001').trim() || 'CUS-001',
      staffId: userId,
      companyId,
      orderType,
      checkoutMode,
      discountAmount,
      promoCode: dataPayload.discount && dataPayload.discount.active ? dataPayload.discount.code : undefined,
      paymentMethod,
      items: Array.isArray(dataPayload.cart)
        ? dataPayload.cart.map((item) => ({
          productId: item.id,
          quantity: Number(item.qty || item.quantity || 1),
          itemPrice: item.price,
        }))
        : [],
    };

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-role': userRole,
      },
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('Order create failed', response.status, text);
      throw new Error(`Order create failed with status ${response.status}`);
    }

    const backendOrder = await response.json();

    if (orderType === 'delivery') {
      // app.js declared customerName/address twice; the later keys win.
      const deliveryPayload = {
        orderId: String(backendOrder.id || '').trim(),
        customerName: String(customerPayload.name || (customerRecord && customerRecord.name) || '').trim() || undefined,
        address: String(customerPayload.address || (customerRecord && customerRecord.address) || '').trim() || undefined,
        partnerName: String(customerPayload.deliveryPartner || '').trim() || undefined,
        partnerPhone: String(customerPayload.deliveryPartnerPhone || '').trim() || undefined,
        dispatchDate: new Date().toISOString().slice(0, 10),
      };
      try {
        const deliveryResponse = await fetch(`${API_BASE}/deliveries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-role': userRole,
          },
          body: JSON.stringify(deliveryPayload),
        });
        if (!deliveryResponse.ok) {
          const bodyText = await deliveryResponse.text().catch(() => '');
          console.warn('Delivery create rejected:', deliveryResponse.status, bodyText);
        }
      } catch (error) {
        console.warn('Delivery create failed after order submit:', error);
      }
    }

    const itemCount = Array.isArray(dataPayload.cart) ? sumCartQty(dataPayload.cart) : 0;
    const total = Array.isArray(dataPayload.cart) ? sumCartTotal(dataPayload.cart) : 0;

    const updatePayload = {
      customerName: String((customerRecord && customerRecord.name) || customerPayload.name || '').trim(),
      customerAddress: String(customerPayload.address || '').trim() || undefined,
      itemsCount: itemCount,
      total: Math.max(0, total - discountAmount + Math.max(0, Number(customerPayload.deliveryCharge || 0))),
      status: String(customerPayload.orderStatus || 'Processing').trim() || 'Processing',
      paymentMethod: String(customerPayload.paymentMethod || paymentMethod || 'Pending').trim() || 'Pending',
    };

    try {
      const updateResponse = await fetch(`${API_BASE}/orders/${encodeURIComponent(String(backendOrder.id))}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-role': userRole,
        },
        body: JSON.stringify(updatePayload),
      });
      const updateText = await updateResponse.text().catch(() => '');
      let updateJson = null;
      try {
        updateJson = updateText ? JSON.parse(updateText) : null;
      } catch {
        updateJson = null;
      }
      console.debug('Order post-create update response:', updateResponse.status, updateJson || updateText);
      if (updateResponse.ok) {
        return {
          backendOrder: updateJson || backendOrder,
          customerRecord,
        };
      }
    } catch (error) {
      console.warn('Order post-create update failed:', error);
    }

    console.debug('Returning initial backendOrder after create:', backendOrder);
    const computedTotal = Array.isArray(dataPayload.cart) ? sumCartTotal(dataPayload.cart) : 0;

    try {
      const listResp = await fetch(`${API_BASE}/orders?companyId=${encodeURIComponent(companyId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-role': userRole },
      });
      if (listResp.ok) {
        const listJson = await listResp.json();
        if (Array.isArray(listJson)) {
          const now = Date.now();
          const candidate = listJson.find((o) => {
            const oTotal = Number((o && o.total) || 0);
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

// app.js UI.setCallbacks({ onCheckout }) - backend submit, then local order record.
export async function runCheckout(dataStore, dataPayload) {
  const backendResult = await submitOrderToBackend(dataPayload);
  if (!backendResult || !backendResult.backendOrder || !backendResult.backendOrder.id) {
    console.warn('Backend order missing or incomplete, proceeding with local order creation', backendResult);
  }
  const newOrder = dataStore.createOrder(
    dataPayload.customer,
    dataPayload.cart,
    dataPayload.discount,
    {
      backendOrder: backendResult && backendResult.backendOrder,
      customerId: backendResult && backendResult.customerRecord && backendResult.customerRecord.id,
      customerRecord: backendResult && backendResult.customerRecord,
    }
  );

  console.log('Simulating gateway redirect for order:', newOrder);
  return newOrder;
}
