// Prints only the bill (.receipt); other Print buttons print the whole page.
export default function printReceipt() {
  document.body.classList.add('printing-receipt');
  const done = () => {
    document.body.classList.remove('printing-receipt');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}
