import useReveal from './useReveal.js';

export default function SectionHeader({ ids = {}, tag, title, desc }) {
  const [ref, revealClass] = useReveal();
  return (
    <div ref={ref} className={`section-header ${revealClass}`}>
      <span className="section-tag" id={ids.tag}>{tag}</span>
      <h2 className="section-title" id={ids.title}>{title}</h2>
      <p className="section-desc" id={ids.desc}>{desc}</p>
    </div>
  );
}
