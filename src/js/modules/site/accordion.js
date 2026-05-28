const DURATION = 320;
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

function animateOpen(details, summary, content) {
  details.style.overflow = 'hidden';
  const startHeight = `${details.offsetHeight}px`;
  details.open = true;
  const endHeight = `${details.offsetHeight}px`;
  details.style.height = startHeight;

  const anim = details.animate({ height: [startHeight, endHeight] }, { duration: DURATION, easing: EASING });
  anim.onfinish = () => {
    details.style.height = '';
    details.style.overflow = '';
    summary.setAttribute('aria-expanded', 'true');
  };
}

function animateClose(details, summary) {
  details.style.overflow = 'hidden';
  details.style.height = `${details.offsetHeight}px`;

  const anim = details.animate(
    { height: [`${details.offsetHeight}px`, `${details.querySelector('summary').offsetHeight}px`] },
    { duration: DURATION, easing: EASING }
  );
  anim.onfinish = () => {
    details.open = false;
    details.style.height = '';
    details.style.overflow = '';
    summary.setAttribute('aria-expanded', 'false');
  };
}

export function initAccordion(container = document) {
  const allDetails = [...container.querySelectorAll('details')];

  allDetails.forEach(details => {
    const summary = details.querySelector('summary');
    summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');

    summary.addEventListener('click', e => {
      e.preventDefault();
      const isOpen = details.open;

      // Close all others
      allDetails.forEach(other => {
        if (other !== details && other.open) {
          animateClose(other, other.querySelector('summary'));
        }
      });

      if (isOpen) {
        animateClose(details, summary);
      } else {
        animateOpen(details, summary, details.querySelector('summary + *'));
      }
    });
  });
}
