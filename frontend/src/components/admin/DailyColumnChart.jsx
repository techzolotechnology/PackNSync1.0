import { useMemo, useState } from 'react';

const HEIGHT = 160;
const PAD = { top: 18, right: 8, bottom: 22, left: 44 };
const MAX_BAR = 24;
const GAP = 2;

/** Round the axis max up to a clean number (1, 2, 5 × 10^n). */
function niceMax(value) {
    if (value <= 0) return 1;
    const exp = 10 ** Math.floor(Math.log10(value));
    const f = value / exp;
    const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return step * exp;
}

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Column with a 4px rounded top and a square base on the baseline. */
function columnPath(x, y, w, h) {
    if (h <= 0) return '';
    const r = Math.min(4, w / 2, h);
    return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Single-series daily column chart. One series, so no legend: the title names it.
 * Every value is reachable via hover/focus tooltips and the table view.
 *
 * series: [{ date: 'YYYY-MM-DD', value: number }]
 */
export default function DailyColumnChart({ title, subtitle, series, format = (v) => v.toLocaleString('en-IN') }) {
    const [active, setActive] = useState(null);
    const [showTable, setShowTable] = useState(false);
    const width = 560; // viewBox width; the SVG scales to its container

    const { max, ticks, peakIndex } = useMemo(() => {
        const top = niceMax(Math.max(0, ...series.map((d) => d.value)));
        let peak = -1;
        series.forEach((d, i) => { if (d.value > 0 && (peak < 0 || d.value > series[peak].value)) peak = i; });
        return { max: top, ticks: [0, top / 2, top], peakIndex: peak };
    }, [series]);

    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const slot = plotW / Math.max(series.length, 1);
    const barW = Math.max(2, Math.min(MAX_BAR, slot - GAP));
    const y = (v) => PAD.top + plotH - (v / max) * plotH;
    const total = series.reduce((s, d) => s + d.value, 0);

    const tooltip = active !== null && series[active] ? (() => {
        const d = series[active];
        const left = ((PAD.left + active * slot + slot / 2) / width) * 100;
        // Anchor just above the hovered bar's top, not the top of the plot.
        const top = (y(d.value) / HEIGHT) * 100;
        return (
            <div className="adm-chart-tip" style={{ left: `${left}%`, top: `${top}%` }} role="status">
                <strong>{format(d.value)}</strong>
                <span>{shortDate(d.date)}</span>
            </div>
        );
    })() : null;

    return (
        <figure className="adm-chart">
            <figcaption className="adm-chart-head">
                <div>
                    <h3>{title}</h3>
                    <p>{subtitle} · total <strong>{format(total)}</strong></p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>
                    {showTable ? 'Chart' : 'Table'}
                </button>
            </figcaption>

            {showTable ? (
                <div className="admin-table-wrap adm-chart-table">
                    <table className="admin-table">
                        <thead><tr><th>Date</th><th>{title}</th></tr></thead>
                        <tbody>
                            {[...series].reverse().map((d) => (
                                <tr key={d.date}><td>{shortDate(d.date)}</td><td>{format(d.value)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="adm-chart-plot" onPointerLeave={() => setActive(null)}>
                    <svg viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={`${title}, last ${series.length} days`}>
                        {ticks.map((t) => (
                            <g key={t}>
                                <line className="adm-chart-gridline" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
                                <text className="adm-chart-axis" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
                            </g>
                        ))}
                        {series.map((d, i) => {
                            const x = PAD.left + i * slot + (slot - barW) / 2;
                            const h = (d.value / max) * plotH;
                            return (
                                <g key={d.date}>
                                    <path
                                        className={`adm-chart-bar ${active === i ? 'is-active' : ''}`}
                                        d={columnPath(x, y(d.value), barW, h)}
                                    />
                                    {/* Hit target is the whole slot, taller and wider than the mark */}
                                    <rect
                                        className="adm-chart-hit"
                                        x={PAD.left + i * slot}
                                        y={PAD.top}
                                        width={slot}
                                        height={plotH}
                                        tabIndex={0}
                                        aria-label={`${shortDate(d.date)}: ${format(d.value)}`}
                                        onPointerEnter={() => setActive(i)}
                                        onFocus={() => setActive(i)}
                                        onBlur={() => setActive(null)}
                                    />
                                </g>
                            );
                        })}
                        {peakIndex >= 0 && (
                            <text
                                className="adm-chart-label"
                                x={PAD.left + peakIndex * slot + slot / 2}
                                y={y(series[peakIndex].value) - 5}
                                textAnchor="middle"
                            >
                                {format(series[peakIndex].value)}
                            </text>
                        )}
                        <line className="adm-chart-baseline" x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />
                        {series.length > 0 && (
                            <>
                                <text className="adm-chart-axis" x={PAD.left} y={HEIGHT - 6}>{shortDate(series[0].date)}</text>
                                <text className="adm-chart-axis" x={width - PAD.right} y={HEIGHT - 6} textAnchor="end">
                                    {shortDate(series[series.length - 1].date)}
                                </text>
                            </>
                        )}
                    </svg>
                    {tooltip}
                </div>
            )}
        </figure>
    );
}
