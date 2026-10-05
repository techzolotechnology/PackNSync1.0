import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import useSeo from '../hooks/useSeo.js';
import { canonicalUrl } from '../seo/seoConfig.js';
import { GUIDES, findGuide, guideJsonLd, guideSeo } from '../seo/guides.js';
import './Destinations.css';
import './GuidePage.css';

/** /guides/:slug — one travel guide article. */
export default function GuidePage() {
    const { slug } = useParams();
    const guide = findGuide(slug);

    const jsonLd = useMemo(
        () => (guide ? guideJsonLd(guide, canonicalUrl(`guides/${guide.slug}`)) : null),
        [guide],
    );
    useSeo(guide ? { ...guideSeo(guide), path: `guides/${guide.slug}`, jsonLd } : {});

    if (!guide) return <Navigate to="/guides/" replace />;
    const more = GUIDES.filter((g) => g.slug !== guide.slug);

    return (
        <div className="dst-page page-atmosphere page-enter">
            <article className="container guide-article">
                <nav className="dst-crumbs" aria-label="Breadcrumb">
                    <Link to="/guides/">Guides</Link> <span aria-hidden="true">/</span> {guide.tags[0]}
                </nav>

                <header>
                    <h1>{guide.title}</h1>
                    <p className="guide-meta">
                        {format(new Date(guide.published), 'd MMMM yyyy')} · {guide.readMinutes} min read
                    </p>
                    <p className="dst-lead">{guide.intro}</p>
                </header>

                {guide.sections.map((section) => (
                    <section key={section.heading} className="guide-section">
                        <h2>{section.heading}</h2>
                        {section.paragraphs?.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
                        {section.list && (
                            <ul>{section.list.map((item) => <li key={item}>{item}</li>)}</ul>
                        )}
                        {section.steps && (
                            <ol>{section.steps.map((item) => <li key={item}>{item}</li>)}</ol>
                        )}
                    </section>
                ))}

                {guide.cta && (
                    <div className="guide-cta card">
                        <p>Travelling with a group? PickAndSync keeps the plan, chat and shared expenses in one place.</p>
                        <div className="dst-actions">
                            <Link to={guide.cta.to} className="btn btn-primary">{guide.cta.label}</Link>
                            <Link to="/trips/create" className="btn btn-ghost">Create a group trip</Link>
                        </div>
                    </div>
                )}

                {more.length > 0 && (
                    <section className="guide-section">
                        <h2>More guides</h2>
                        <ul className="guide-more">
                            {more.map((g) => (
                                <li key={g.slug}><Link to={`/guides/${g.slug}/`}>{g.title}</Link></li>
                            ))}
                        </ul>
                    </section>
                )}
            </article>
        </div>
    );
}
