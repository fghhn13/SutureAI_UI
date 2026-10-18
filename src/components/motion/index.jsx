import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

/**
 * Small motion primitives shared by the pages. MotionConfig (main.jsx) already honours
 * "reduce motion"; CountUp checks it itself because it animates text, not a style.
 */

export const EASE = [0.22, 1, 0.36, 1];

/** Fade and lift into place once, when scrolled into view. */
export function Reveal({ as = "div", delay = 0, y = 8, className, children, ...rest }) {
  const Tag = motion[as] ?? motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Parent that staggers its <StaggerItem> children in. */
export function Stagger({ as = "div", gap = 0.07, delay = 0, className, children, ...rest }) {
  const Tag = motion[as] ?? motion.div;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export function StaggerItem({ as = "div", className, children, ...rest }) {
  const Tag = motion[as] ?? motion.div;
  return (
    <Tag className={className} variants={staggerItem} {...rest}>
      {children}
    </Tag>
  );
}

/** Number that counts up from 0 the first time it is seen, and tweens on later changes. */
export function CountUp({ value, duration = 1.2, delay = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setShown(value);
      return undefined;
    }
    const controls = animate(from.current, value, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {shown}
    </span>
  );
}

/** Bar fill that grows to `percent` when first seen, and follows later changes. */
export function GrowBar({ percent, delay = 0, className = "", style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ width: 0 }}
      animate={{ width: inView ? width : 0 }}
      transition={{ duration: 1, ease: EASE, delay }}
    />
  );
}
