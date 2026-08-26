/**
 * validation.js — Client-side form validation for Step 1
 */

const Validator = (() => {
    'use strict';

    function validateCustomerStep(input, phoneArg) {
        const customer = (input && typeof input === 'object')
            ? input
            : { name: input, phone: phoneArg };
        const errors = {};
        const name = String(customer.name || '').trim();
        const phone = String(customer.phone || '').trim();
        const phoneDigits = phone.replace(/\D/g, '');
        const email = String(customer.email || '').trim();
        const address = String(customer.address || '').trim();
        const deliveryPartnerPhone = String(customer.deliveryPartnerPhone || '').trim();
        const deliveryPartnerPhoneDigits = deliveryPartnerPhone.replace(/\D/g, '');
        const deliveryOption = String(customer.deliveryOption || 'pickup').trim().toLowerCase();
        
        if (!name) {
            errors.name = 'Customer name is required.';
        } else if (name.length < 3) {
            errors.name = 'Name must be at least 3 characters.';
        }

        if (!phone) {
            errors.phone = 'Phone number is required.';
        } else if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
            errors.phone = 'Phone must be exactly 10 digits.';
        }

        if (email && !/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/.test(email)) {
            errors.email = 'Enter a valid email address.';
        }

        if (deliveryOption === 'delivery' && address.length < 8) {
            errors.address = 'Address is required for delivery orders.';
        }

        if (deliveryOption === 'delivery' && deliveryPartnerPhone && !/^[6-9]\d{9}$/.test(deliveryPartnerPhoneDigits)) {
            errors.deliveryPartnerPhone = 'Enter a valid 10-digit phone number.';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    return {
        validateCustomerStep
    };
})();
