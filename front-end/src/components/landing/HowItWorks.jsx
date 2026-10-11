import SectionHeader from './SectionHeader.jsx';
import useReveal from './useReveal.js';

const STEPS = [
  { number: '01', title: 'Create Your Account', description: 'Sign up in 30 seconds with just your email. No credit card required to start your free trial.' },
  { number: '02', title: 'Add Your Products', description: 'Import your catalog via CSV or add items manually. Set prices, categories, and stock levels in one go.' },
  { number: '03', title: 'Start Billing', description: 'Create invoices, track orders, and manage inventory — all from a single beautiful dashboard.' },
];

function StepCard({ number, title, description, showConnector }) {
  const [ref, revealClass] = useReveal();
  return (
    <div ref={ref} className={`step-card ${revealClass}`}>
      <div className="step-number">{number}</div>
      <div className="step-content">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {showConnector && <div className="step-connector"></div>}
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="container">
        <SectionHeader
          ids={{ tag: 'howTag', title: 'howTitle', desc: 'howDesc' }}
          tag="How It Works"
          title="Up and running in minutes"
          desc="No complex setup. No training needed. Just sign up and start billing."
        />
        <div className="steps-grid" id="stepsGrid">
          {STEPS.map((step, index) => (
            <StepCard key={step.number} {...step} showConnector={index < STEPS.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
