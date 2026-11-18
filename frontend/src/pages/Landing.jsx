// Landing page for signed-out visitors: hook, short tutorial with real screenshots, sign-up CTA.
import { useEffect, useRef } from "react";
import { Icon, SourceIcon } from "../components/Icons.jsx";
import { LanguageSwitch, useT } from "../i18n.jsx";

/** Fades sections in as they scroll into view (skipped when the user prefers less motion). */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = root.querySelectorAll(".reveal");
    els.forEach((el) => el.classList.add("pending"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove("pending"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

function Shot({ name, alt, className = "" }) {
  const t = useT();
  return (
    <figure className={`land-shot ${className}`}>
      <img src={`/landing/${name}-${t.lang === "en" ? "en" : "uk"}.webp`} alt={alt} decoding="async" />
    </figure>
  );
}

const STEPS = [
  { n: 1, shot: "add" },
  { n: 2, shot: "card" },
  { n: 3, shot: "library" },
  { n: 4, shot: "search" },
];

export function Landing({ appName }) {
  const t = useT();
  const ref = useReveal();
  const lang = t.lang === "en" ? "en" : "uk";

  return (
    <div className="land" ref={ref}>
      <header className="land-bar">
        <a className="brand" href="#/"><span className="mark">Re</span>{appName.slice(2)}</a>
        <LanguageSwitch compact />
        <a className="btn ghost land-signin" href="#/signin">{t("land.signin")}</a>
        <a className="btn primary" href="#/signup">{t("land.cta")}</a>
      </header>

      <section className="land-hero">
        <p className="land-badge"><span className="dot" />{t("land.badge")}</p>
        <h1 className="land-title">
          {t("land.t1")}<br />
          <span className="hl">{t("land.t2")}</span> {t("land.t3")}
        </h1>
        <p className="land-sub">{t("land.sub")}</p>
        <div className="land-ctas">
          <a className="btn primary big" href="#/signup">{t("land.cta")} <Icon name="arrow" size={20} /></a>
          <button type="button" className="btn big"
            onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>{t("land.how")}</button>
        </div>
        <p className="land-note">{t("land.note")}</p>

        <div className="land-visual">
          <div className="browser">
            <div className="browser-bar"><i /><i /><i /><span>recall-ojro.onrender.com</span></div>
            <img src={`/landing/hero-${lang}.webp`} alt="" width="1000" height="640" />
          </div>
          <div className="float f-query"><Icon name="search" size={18} /><span>{t("land.fq")}</span></div>
          <div className="float f-ai"><span className="f-ai-ic"><Icon name="sparkle" size={18} /></span>
            <span><b>{t("land.fai")}</b><small>{t("land.ftopic")}</small></span></div>
          <div className="float f-srcs">
            <SourceIcon type="youtube" size={22} /><SourceIcon type="pdf" size={22} />
            <SourceIcon type="web" size={22} /><SourceIcon type="tiktok" size={22} />
          </div>
        </div>
      </section>

      <section className="land-pain">
        <div className="land-wrap">
          <p className="kicker reveal">{t("land.pain.k")}</p>
          <h2 className="land-h2 reveal">{t("land.pain.t")}</h2>
          <div className="pain-grid">
            {[1, 2, 3].map((i) => (
              <div className="pain-card reveal" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
                <b>{t(`land.pain.${i}a`)}</b><span>{t(`land.pain.${i}b`)}</span>
              </div>
            ))}
          </div>
          <p className="pain-quote reveal"><s>{t("land.pain.q1")}</s><br /><span className="hl">{t("land.pain.q2")}</span></p>
        </div>
      </section>

      <section className="land-tut" id="how">
        <div className="land-wrap">
          <p className="kicker reveal">{t("land.tut.k")}</p>
          <h2 className="land-h2 reveal">{t("land.tut.t")}</h2>
          <ol className="steps">
            {STEPS.map(({ n, shot }) => (
              <li className="step reveal" key={n}>
                <div className="step-text">
                  <span className="step-num">{n}</span>
                  <h3>{t(`land.s${n}.t`)}</h3>
                  <p>{t(`land.s${n}.d`)}</p>
                </div>
                <Shot name={shot} alt={t(`land.s${n}.t`)} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="land-why">
        <div className="land-wrap">
          <p className="kicker reveal">{t("land.why.k")}</p>
          <div className="why-grid">
            {[["bolt", 1], ["brain", 2], ["books", 3]].map(([ic, i]) => (
              <div className="why-card reveal" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="why-ic"><Icon name={ic} size={24} /></span>
                <h3>{t(`land.why.${i}t`)}</h3>
                <p>{t(`land.why.${i}d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="land-end reveal">
        <h2>{t("land.end.t")}</h2>
        <p>{t("land.end.d")}</p>
        <a className="btn primary big" href="#/signup">{t("land.cta")} <Icon name="arrow" size={20} /></a>
      </section>

      <footer className="land-foot">
        <span className="brand small-brand"><span className="mark">Re</span>{appName.slice(2)}</span>
        <span>{t("land.foot")}</span>
      </footer>
    </div>
  );
}
