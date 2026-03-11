CREATE DATABASE BillBhai_Retail_System;
USE BillBhai_Retail_System;

CREATE TABLE COMPANY (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    address TEXT,
    email VARCHAR(100) UNIQUE,
    phone_no VARCHAR(15) UNIQUE,
    gst_no VARCHAR(30) UNIQUE
);

CREATE TABLE STAFF (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    mobile_no VARCHAR(15) UNIQUE,
);

CREATE TABLE CUSTOMER (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile_no VARCHAR(15) UNIQUE,
    email VARCHAR(100) UNIQUE,
    address TEXT
);

CREATE TABLE LOYALTY_MEMBER (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNIQUE NOT NULL,
    points_balance INT DEFAULT 0,
    tier_level VARCHAR(50),
    joined_date DATE,

    CONSTRAINT fk_loyalty_customer
    FOREIGN KEY (customer_id)
    REFERENCES CUSTOMER(customer_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE SUPPLIER (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mobile_no VARCHAR(15),
    email VARCHAR(100),
    address TEXT,
    gst_no VARCHAR(30) UNIQUE
);

CREATE TABLE PRODUCT (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    selling_company VARCHAR(150),
    barcode VARCHAR(100) UNIQUE,
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    size VARCHAR(50),
    description TEXT,

    CONSTRAINT fk_product_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES SUPPLIER(supplier_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE INVENTORY (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNIQUE NOT NULL,
    stock_available INT NOT NULL DEFAULT 0,
    reorder_level INT DEFAULT 10,
    location VARCHAR(100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_product
    FOREIGN KEY (product_id)
    REFERENCES PRODUCT(product_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE ORDERS (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    staff_id INT NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    order_type VARCHAR(50),
    checkout_mode VARCHAR(50),
    total_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50),

    CONSTRAINT fk_order_customer
    FOREIGN KEY (customer_id)
    REFERENCES CUSTOMER(customer_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

    CONSTRAINT fk_order_staff
    FOREIGN KEY (staff_id)
    REFERENCES STAFF(staff_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE ORDER_ITEM (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    item_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2),

    CONSTRAINT fk_orderitem_order
    FOREIGN KEY (order_id)
    REFERENCES ORDERS(order_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

    CONSTRAINT fk_orderitem_product
    FOREIGN KEY (product_id)
    REFERENCES PRODUCT(product_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE BILL (
    bill_no INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNIQUE NOT NULL,
    bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2),

    CONSTRAINT fk_bill_order
    FOREIGN KEY (order_id)
    REFERENCES ORDERS(order_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE PAYMENT (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    bill_no INT NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50),
    amount_paid DECIMAL(10,2),

    CONSTRAINT fk_payment_bill
    FOREIGN KEY (bill_no)
    REFERENCES BILL(bill_no)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE DELIVERY (
    delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNIQUE NOT NULL,
    partner_name VARCHAR(150),
    dispatch_date DATE,
    delivery_date DATE,
    status VARCHAR(50),

    CONSTRAINT fk_delivery_order
    FOREIGN KEY (order_id)
    REFERENCES ORDERS(order_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE RETURN (
    return_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    return_date DATE,
    reason TEXT,
    refund_amount DECIMAL(10,2),
    status VARCHAR(50),
    return_type VARCHAR(50),

    CONSTRAINT fk_return
    FOREIGN KEY (order_id)
    REFERENCES ORDERS(order_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE INVOICE (
    invoice_no INT AUTO_INCREMENT PRIMARY KEY,
    bill_no INT NOT NULL,
    invoice_date DATE,
    invoice_status VARCHAR(50),

    CONSTRAINT fk_invoice_bill
    FOREIGN KEY (bill_no)
    REFERENCES BILL(bill_no)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE REPORT (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(50),
    generated_by INT,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    period_from DATE,
    period_to DATE,

    CONSTRAINT fk_report_staff
    FOREIGN KEY (generated_by)
    REFERENCES STAFF(staff_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
