// `.toast-popup` is hidden by CSS until the page sets `display: block`.
export default function Toast({ message, visible }) {
  return (
    <div className="toast-popup" id="toast" style={visible ? { display: 'block' } : undefined}>{message}</div>
  );
}
