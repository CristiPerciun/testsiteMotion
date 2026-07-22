import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Clock3,
  Leaf,
  Menu,
  MoveRight,
  Scissors,
  Sprout,
  X,
} from 'lucide-react';

const BASE_IMAGE = '/assets/bonsai-night.png';
const REVEAL_IMAGE = '/assets/bonsai-rain.png';
const SPOTLIGHT_R = 270;

type Point = { x: number; y: number };

function RevealLayer({ image, cursorX, cursorY }: { image: string; cursorX: number; cursorY: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resizeCanvas = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reveal = revealRef.current;
    if (!canvas || !reveal) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const radius = Math.min(SPOTLIGHT_R, Math.max(175, window.innerWidth * 0.2));
    const gradient = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.75)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(0.88, 'rgba(255,255,255,0.12)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, radius, 0, Math.PI * 2);
    ctx.fill();

    const mask = `url(${canvas.toDataURL()})`;
    reveal.style.maskImage = mask;
    reveal.style.webkitMaskImage = mask;
    reveal.style.maskSize = '100% 100%';
    reveal.style.webkitMaskSize = '100% 100%';
  }, [cursorX, cursorY]);

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 hidden" aria-hidden="true" />
      <div
        ref={revealRef}
        className="reveal-image pointer-events-none absolute inset-0 z-30 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${image})` }}
        aria-hidden="true"
      />
    </>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    ['Filosofia', '#filosofia'],
    ['Collezione', '#collezione'],
    ['Metodo', '#metodo'],
    ['Visite', '#visite'],
  ];

  return (
    <nav className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-5 py-5 sm:px-8" aria-label="Navigazione principale">
      <a className="brand group flex items-center gap-3 text-white" href="#top" aria-label="Kanso Bonsai, torna all'inizio">
        <span className="brand-mark grid h-9 w-9 place-items-center rounded-full border border-white/35 text-sm">間</span>
        <span className="font-display text-[1.7rem] italic leading-none">Kanso</span>
      </a>

      <div className="nav-pill absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/25 bg-black/25 p-1.5 backdrop-blur-xl md:flex">
        {links.map(([label, href], index) => (
          <a
            key={href}
            href={href}
            className={`rounded-full px-4 py-2 text-xs font-medium tracking-wide transition ${index === 0 ? 'bg-white text-ink' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            {label}
          </a>
        ))}
      </div>

      <a className="button-light hidden items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-ink transition hover:scale-[1.03] md:flex" href="#visite">
        Prenota una visita <ArrowUpRight size={15} />
      </a>

      <button className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-lg md:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Chiudi menu' : 'Apri menu'}>
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>

      <div id="mobile-menu" className={`mobile-menu fixed inset-0 -z-10 flex flex-col bg-ink px-6 pb-10 pt-28 transition duration-500 md:hidden ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        {links.map(([label, href], index) => (
          <a key={href} href={href} onClick={() => setOpen(false)} className="mobile-link border-t border-white/15 py-5 font-display text-4xl text-white" style={{ transitionDelay: open ? `${index * 70}ms` : '0ms' }}>
            {label}
          </a>
        ))}
        <a href="#visite" onClick={() => setOpen(false)} className="mt-auto flex items-center justify-between rounded-full bg-clay px-6 py-4 text-sm font-semibold text-white">
          Prenota una visita <ArrowUpRight size={18} />
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  const mouse = useRef<Point>({ x: -999, y: -999 });
  const smooth = useRef<Point>({ x: -999, y: -999 });
  const rafRef = useRef<number>();
  const [cursorPos, setCursorPos] = useState<Point>({ x: -999, y: -999 });

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      mouse.current = { x: event.clientX, y: event.clientY };
      if (smooth.current.x < -900) smooth.current = { ...mouse.current };
    };

    const animate = () => {
      smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1;
      smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1;
      setCursorPos({ ...smooth.current });
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section id="top" className="hero relative h-screen min-h-[680px] w-full overflow-hidden bg-black" style={{ height: '100dvh' }}>
      <div className="hero-base hero-zoom absolute inset-0 z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${BASE_IMAGE})` }} aria-hidden="true" />
      <div className="absolute inset-0 z-20 bg-black/20" aria-hidden="true" />
      <RevealLayer image={REVEAL_IMAGE} cursorX={cursorPos.x} cursorY={cursorPos.y} />
      <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(180deg,rgba(0,0,0,.42)_0%,transparent_28%,transparent_60%,rgba(0,0,0,.68)_100%)]" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-x-0 top-[16%] z-50 flex flex-col items-center px-5 text-center sm:top-[14%]">
        <span className="hero-anim hero-fade mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/65" style={{ animationDelay: '0.12s' }}>
          <span className="h-px w-8 bg-white/40" /> Atelier botanico · Italia <span className="h-px w-8 bg-white/40" />
        </span>
        <h1 className="max-w-6xl text-white leading-[0.86]">
          <span className="hero-anim hero-reveal font-display block text-[clamp(4.3rem,10vw,9.4rem)] font-normal italic tracking-[-0.07em]" style={{ animationDelay: '0.25s' }}>L'arte di</span>
          <span className="hero-anim hero-reveal block text-[clamp(3.25rem,8.6vw,8rem)] font-light tracking-[-0.075em]" style={{ animationDelay: '0.42s' }}>fermare il tempo</span>
        </h1>
      </div>

      <div className="hero-anim hero-fade absolute bottom-8 left-5 z-50 max-w-[260px] sm:bottom-12 sm:left-8" style={{ animationDelay: '0.75s' }}>
        <p className="hidden text-xs leading-relaxed text-white/70 sm:block">Ogni ramo custodisce una scelta. Ogni cicatrice, una stagione. Noi coltiviamo il tempo nella sua forma più essenziale.</p>
      </div>

      <div className="hero-anim hero-fade absolute bottom-7 right-5 z-50 flex items-end gap-4 sm:bottom-10 sm:right-8" style={{ animationDelay: '0.9s' }}>
        <div className="hidden text-right sm:block">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Muovi il cursore</p>
          <p className="mt-1 text-xs text-white/80">Scopri la pioggia</p>
        </div>
        <a href="#filosofia" className="group grid h-14 w-14 place-items-center rounded-full border border-white/35 bg-white/10 text-white backdrop-blur-md transition hover:bg-white hover:text-ink" aria-label="Scorri verso il contenuto">
          <ArrowDown className="transition group-hover:translate-y-1" size={19} />
        </a>
      </div>

      <div className="pointer-ring absolute z-[60] hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/65 lg:block" style={{ left: cursorPos.x, top: cursorPos.y }} aria-hidden="true" />
    </section>
  );
}

type TiltCardProps = {
  number: string;
  title: string;
  japanese: string;
  text: string;
  image: string;
  imagePosition: string;
};

function TiltCard({ number, title, japanese, text, image, imagePosition }: TiltCardProps) {
  const cardRef = useRef<HTMLElement>(null);

  const onMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!cardRef.current || event.pointerType === 'touch') return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    cardRef.current.style.transform = `perspective(1000px) rotateX(${-y * 8}deg) rotateY(${x * 10}deg) translateY(-6px)`;
    cardRef.current.style.setProperty('--glow-x', `${(x + 0.5) * 100}%`);
    cardRef.current.style.setProperty('--glow-y', `${(y + 0.5) * 100}%`);
  };

  const reset = () => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
  };

  return (
    <article ref={cardRef} onPointerMove={onMove} onPointerLeave={reset} className="tilt-card group relative min-h-[510px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11140f] transition-transform duration-300 ease-out">
      <div className="absolute inset-0 scale-[1.03] bg-cover transition duration-700 group-hover:scale-100" style={{ backgroundImage: `url(${image})`, backgroundPosition: imagePosition }} aria-hidden="true" />
      <div className="card-shade absolute inset-0" aria-hidden="true" />
      <div className="card-glow absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
      <div className="relative z-10 flex h-full min-h-[510px] flex-col justify-between p-6 sm:p-8">
        <div className="flex items-start justify-between text-white/70">
          <span className="text-[10px] font-semibold tracking-[0.24em]">{number}</span>
          <span className="text-lg">{japanese}</span>
        </div>
        <div>
          <h3 className="font-display text-5xl italic text-white sm:text-6xl">{title}</h3>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">{text}</p>
          <span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">Esplora <MoveRight className="transition group-hover:translate-x-2" size={16} /></span>
        </div>
      </div>
    </article>
  );
}

function App() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.16 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      if (pageRef.current) {
        pageRef.current.style.setProperty('--scroll-y', `${window.scrollY}px`);
        pageRef.current.style.setProperty('--scroll-progress', `${Math.min(1, window.scrollY / Math.max(1, document.body.scrollHeight - innerHeight))}`);
      }
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={pageRef} className="site-shell bg-ink tracking-[-0.02em] text-paper">
      <div className="progress-line fixed left-0 top-0 z-[120] h-[2px] bg-clay" aria-hidden="true" />
      <Nav />
      <main>
        <Hero />

        <section id="filosofia" className="relative overflow-hidden bg-paper px-5 py-28 text-ink sm:px-8 sm:py-40 lg:px-14">
          <div className="absolute right-[-5vw] top-12 select-none font-display text-[28vw] italic leading-none text-black/[0.035]" aria-hidden="true">間</div>
          <div className="mx-auto max-w-[1500px]">
            <div data-reveal className="scroll-reveal grid gap-12 lg:grid-cols-[0.7fr_1.6fr] lg:gap-24">
              <div className="flex items-start gap-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/55">
                <Leaf size={15} /> <span>La filosofia<br />Kanso</span>
              </div>
              <div>
                <h2 className="font-display text-[clamp(3.2rem,7.6vw,8.4rem)] italic leading-[0.92] tracking-[-0.06em]">Un albero piccolo.<br /><span className="not-italic">Un tempo infinito.</span></h2>
                <div className="mt-14 grid gap-9 border-t border-black/15 pt-8 sm:grid-cols-2">
                  <p className="max-w-md text-lg font-medium leading-relaxed">Il bonsai non imita la natura. Ne concentra l'essenza: vento, stagioni e pazienza in pochi centimetri di paesaggio vivo.</p>
                  <p className="max-w-md text-sm leading-relaxed text-ink/60">Nel nostro atelier ogni esemplare viene osservato prima di essere toccato. La forma non viene imposta: emerge, lentamente, dal dialogo tra materia e cura.</p>
                </div>
              </div>
            </div>

            <div className="parallax-frame mt-24 overflow-hidden rounded-[2rem] sm:mt-36" data-reveal>
              <div className="parallax-image h-[68vh] min-h-[540px] bg-cover bg-center" style={{ backgroundImage: `url(${REVEAL_IMAGE})` }} role="img" aria-label="Bonsai antico sotto una pioggia sottile" />
              <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-6 text-white sm:p-10">
                <p className="max-w-xs text-sm leading-relaxed text-white/75">Pinus thunbergii<br />Stile Moyogi · 68 anni</p>
                <span className="font-display text-5xl italic sm:text-7xl">雨の松</span>
              </div>
            </div>
          </div>
        </section>

        <section id="collezione" className="bg-ink px-5 py-28 sm:px-8 sm:py-40 lg:px-14">
          <div className="mx-auto max-w-[1500px]">
            <header data-reveal className="scroll-reveal flex flex-col gap-8 border-b border-white/15 pb-10 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-moss">Collezione selezionata</p>
                <h2 className="font-display text-6xl italic leading-none sm:text-8xl">Tre gesti,<br />tre caratteri.</h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-white/55">Inclina il cursore sulle forme. Ogni stile racconta una diversa risposta dell'albero alla gravità, al clima e al tempo.</p>
            </header>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <TiltCard number="01 / 03" title="Moyogi" japanese="模様木" text="Equilibrio informale. Il tronco cambia direzione, ma l'apice torna sempre al centro." image={BASE_IMAGE} imagePosition="68% center" />
              <TiltCard number="02 / 03" title="Shakan" japanese="斜幹" text="Il vento diventa postura. Una tensione obliqua, ferma e luminosa." image={REVEAL_IMAGE} imagePosition="52% center" />
              <TiltCard number="03 / 03" title="Kengai" japanese="懸崖" text="La chioma scende oltre il vaso: una cascata scolpita dalla perseveranza." image={BASE_IMAGE} imagePosition="84% center" />
            </div>
          </div>
        </section>

        <section id="metodo" className="method-section relative min-h-[260vh] bg-[#d5d0c3] text-ink">
          <div className="sticky top-0 flex h-screen min-h-[720px] items-center overflow-hidden px-5 sm:px-8 lg:px-14">
            <div className="method-orbit absolute left-[55%] top-1/2 h-[58vw] w-[58vw] max-h-[840px] max-w-[840px] -translate-y-1/2 rounded-full border border-black/15" aria-hidden="true">
              <div className="absolute inset-[9%] rounded-full border border-black/10" />
              <div className="absolute inset-[22%] rounded-full border border-black/10" />
            </div>
            <div className="method-photo absolute bottom-[-5%] right-[-7%] h-[88%] w-[66%] bg-contain bg-bottom bg-no-repeat opacity-95" style={{ backgroundImage: `url(${BASE_IMAGE})` }} aria-hidden="true" />
            <div className="relative z-10 mx-auto grid w-full max-w-[1500px] gap-12 lg:grid-cols-[0.85fr_1.2fr]">
              <div>
                <p className="mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-ink/55"><Clock3 size={15} /> Il nostro metodo</p>
                <h2 className="font-display text-[clamp(4rem,8vw,9rem)] italic leading-[0.82] tracking-[-0.06em]">Prima<br /><span className="not-italic">osservare.</span></h2>
              </div>
              <div className="method-steps self-end pb-10 lg:pl-[26%]">
                <article className="method-step border-t border-black/20 py-5" data-step="01">
                  <div className="flex items-start gap-5"><Sprout className="mt-1" size={18} /><div><p className="text-[10px] font-semibold tracking-[0.2em] text-ink/45">01 · ASCOLTO</p><h3 className="mt-2 text-2xl font-medium">Leggere la direzione</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/55">Radici, vuoti e linee naturali indicano già la forma possibile.</p></div></div>
                </article>
                <article className="method-step border-t border-black/20 py-5" data-step="02">
                  <div className="flex items-start gap-5"><Scissors className="mt-1" size={18} /><div><p className="text-[10px] font-semibold tracking-[0.2em] text-ink/45">02 · GESTO</p><h3 className="mt-2 text-2xl font-medium">Togliere con rispetto</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/55">La potatura crea respiro. Il filo accompagna, senza forzare.</p></div></div>
                </article>
                <article className="method-step border-y border-black/20 py-5" data-step="03">
                  <div className="flex items-start gap-5"><Clock3 className="mt-1" size={18} /><div><p className="text-[10px] font-semibold tracking-[0.2em] text-ink/45">03 · TEMPO</p><h3 className="mt-2 text-2xl font-medium">Lasciare accadere</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/55">Tra un intervento e l'altro, l'albero completa il lavoro.</p></div></div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section id="visite" className="relative isolate flex min-h-screen items-center overflow-hidden bg-black px-5 py-24 sm:px-8 lg:px-14">
          <div className="cta-image absolute inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: `url(${REVEAL_IMAGE})` }} aria-hidden="true" />
          <div className="absolute inset-0 -z-10 bg-black/55" aria-hidden="true" />
          <div data-reveal className="scroll-reveal mx-auto w-full max-w-[1500px] text-center">
            <p className="mb-7 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/65">Visite private · Su appuntamento</p>
            <h2 className="font-display mx-auto max-w-5xl text-[clamp(4.2rem,10vw,10rem)] italic leading-[0.84] tracking-[-0.06em] text-white">Incontra<br /><span className="not-italic">il tuo tempo.</span></h2>
            <p className="mx-auto mt-10 max-w-md text-sm leading-relaxed text-white/65">Una visita guidata tra esemplari unici, tecniche di coltivazione e silenzi che durano da decenni.</p>
            <a href="mailto:atelier@kansobonsai.it" className="group mx-auto mt-10 inline-flex items-center gap-3 rounded-full bg-clay px-7 py-4 text-sm font-semibold text-white transition hover:scale-[1.04] hover:bg-[#a95432]">Prenota la tua visita <ArrowUpRight className="transition group-hover:translate-x-1 group-hover:-translate-y-1" size={18} /></a>
          </div>
        </section>
      </main>

      <footer className="bg-ink px-5 py-8 text-white/45 sm:px-8 lg:px-14">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 border-t border-white/15 pt-7 text-[10px] uppercase tracking-[0.18em] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Kanso Bonsai Atelier</span>
          <span>Coltivato lentamente in Italia</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
