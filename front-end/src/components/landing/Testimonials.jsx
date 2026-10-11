import SectionHeader from './SectionHeader.jsx';
import useReveal from './useReveal.js';

const TESTIMONIALS = [
  {
    quote: 'BillBhai transformed how we handle billing. What used to take 15 minutes per invoice now takes seconds. The inventory tracking alone saved us lakhs.',
    avatar: 'RS',
    name: 'Rahul Sharma',
    role: 'Owner, Sharma Electronics',
  },
  {
    quote: 'We switched from paper billing to BillBhai and saw a 40% increase in order accuracy. The analytics dashboard gives me insights I never had before.',
    avatar: 'PP',
    name: 'Priya Patel',
    role: 'Manager, FreshMart Groceries',
    featured: true,
  },
  {
    quote: 'The delivery tracking feature is a game-changer. Our customers love the real-time updates, and returns handling has become completely painless.',
    avatar: 'AK',
    name: 'Amit Kumar',
    role: 'Founder, QuickDrop Logistics',
  },
];

function TestimonialCard({ quote, avatar, name, role, featured }) {
  const [ref, revealClass] = useReveal();
  return (
    <div ref={ref} className={`testimonial-card ${featured ? 'featured ' : ''}${revealClass}`}>
      <div className="testimonial-stars">★★★★★</div>
      <p className="testimonial-text">"{quote}"</p>
      <div className="testimonial-author">
        <div className="author-avatar">{avatar}</div>
        <div className="author-info">
          <span className="author-name">{name}</span>
          <span className="author-role">{role}</span>
        </div>
      </div>
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="testimonials" id="testimonials">
      <div className="container">
        <SectionHeader
          ids={{ tag: 'testimonialsTag', title: 'testimonialsTitle', desc: 'testimonialsDesc' }}
          tag="Testimonials"
          title="Loved by businesses"
          desc="See what our users have to say about BillBhai."
        />
        <div className="testimonials-grid" id="testimonialsGrid">
          {TESTIMONIALS.map((item) => (
            <TestimonialCard key={item.name} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}
