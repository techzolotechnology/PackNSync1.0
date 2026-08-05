import React from 'react';
import { Link } from 'react-router-dom';
import './TermsAndConditions.css';

const CONTACT_EMAIL = 'kartikgauttam@techzolo.in';
const COMPANY = 'Techzolo Technologies LLP';
const SITE_URL = 'https://pickandsync.com';
const PRIVACY_URL = 'https://pickandsync.com/privacy-policy';

const TOC = [
    { id: 'services', label: '1. Our Services' },
    { id: 'ip', label: '2. Intellectual Property Rights' },
    { id: 'userreps', label: '3. User Representations' },
    { id: 'userreg', label: '4. User Registration' },
    { id: 'purchases', label: '5. Purchases and Payment' },
    { id: 'software', label: '6. Software' },
    { id: 'prohibited', label: '7. Prohibited Activities' },
    { id: 'ugc', label: '8. User Generated Contributions' },
    { id: 'license', label: '9. Contribution License' },
    { id: 'reviews', label: '10. Guidelines for Reviews' },
    { id: 'mobile', label: '11. Mobile Application License' },
    { id: 'thirdparty', label: '12. Third-Party Websites and Content' },
    { id: 'sitemanage', label: '13. Services Management' },
    { id: 'ppyes', label: '14. Privacy Policy' },
    { id: 'copyrightyes', label: '15. Copyright Infringements' },
    { id: 'terms', label: '16. Term and Termination' },
    { id: 'modifications', label: '17. Modifications and Interruptions' },
    { id: 'law', label: '18. Governing Law' },
    { id: 'disputes', label: '19. Dispute Resolution' },
    { id: 'corrections', label: '20. Corrections' },
    { id: 'disclaimer', label: '21. Disclaimer' },
    { id: 'liability', label: '22. Limitations of Liability' },
    { id: 'indemnification', label: '23. Indemnification' },
    { id: 'userdata', label: '24. User Data' },
    { id: 'electronic', label: '25. Electronic Communications' },
    { id: 'california', label: '26. California Users and Residents' },
    { id: 'misc', label: '27. Miscellaneous' },
    { id: 'contact', label: '28. Contact Us' },
];

export default function TermsAndConditions() {
    return (
        <div className="legal-page page-enter page-atmosphere">
            <div className="container legal-wrap">
                <header className="legal-header">
                    <p className="legal-eyebrow">Legal</p>
                    <h1>Terms and Conditions</h1>
                    <p className="legal-updated">Last updated August 05, 2026</p>
                    <nav className="legal-nav" aria-label="Legal documents">
                        <Link to="/terms" className="active">General Terms</Link>
                        <Link to="/terms/ride">Ride</Link>
                        <Link to="/terms/rental">Rental</Link>
                        <Link to="/terms/listing">Listing</Link>
                        <Link to="/privacy-policy">Privacy</Link>
                        <Link to="/refund-policy">Refunds</Link>
                    </nav>
                </header>

                <article className="legal-card card">
                    <section className="legal-section" id="agreement">
                        <h2>Agreement to our Legal Terms</h2>
                        <p>
                            We are <strong>{COMPANY}</strong> (&quot;<strong>Company</strong>,&quot; &quot;<strong>we</strong>,&quot;
                            {' '}&quot;<strong>us</strong>,&quot; &quot;<strong>our</strong>&quot;).
                        </p>
                        <p>
                            We operate the website{' '}
                            <a href={SITE_URL} target="_blank" rel="noreferrer">{SITE_URL}</a>
                            {' '}(the &quot;<strong>Site</strong>&quot;), the mobile application{' '}
                            <strong>PackAndSync</strong> (also referred to as Pick And Sync) (the &quot;<strong>App</strong>&quot;),
                            as well as any other related products and services that refer or link to these legal terms
                            (the &quot;<strong>Legal Terms</strong>&quot;) (collectively, the &quot;<strong>Services</strong>&quot;).
                        </p>
                        <p>
                            PackAndSync is a travel coordination platform for groups. Users can plan and join trips,
                            split expenses, rent community cars and bikes through a self-drive marketplace, compare
                            ride options, and manage bookings from one connected web and mobile app. The product helps
                            friends and crews travel together with clear costs and shared logistics.
                        </p>
                        <p>
                            You can contact us by email at{' '}
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                            {' '}or by mail to <strong>{COMPANY}</strong>, Haryana, India.
                        </p>
                        <p>
                            These Legal Terms constitute a legally binding agreement made between you, whether
                            personally or on behalf of an entity (&quot;<strong>you</strong>&quot;), and {COMPANY},
                            concerning your access to and use of the Services. By accessing the Services, you have
                            read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE
                            WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES
                            AND YOU MUST DISCONTINUE USE IMMEDIATELY.
                        </p>
                        <p>
                            We will provide you with prior notice of any scheduled changes to the Services you are
                            using. The modified Legal Terms will become effective upon posting or notifying you by{' '}
                            <a href="mailto:noreply@pickandsync.com">noreply@pickandsync.com</a>, as stated in the
                            email message. By continuing to use the Services after the effective date of any changes,
                            you agree to be bound by the modified terms.
                        </p>
                        <p>
                            The Services are intended for users who are at least 13 years of age. All users who are
                            minors in the jurisdiction in which they reside (generally under the age of 18) must have
                            the permission of, and be directly supervised by, their parent or guardian to use the
                            Services. If you are a minor, you must have your parent or guardian read and agree to these
                            Legal Terms prior to you using the Services.
                        </p>
                        <p>We recommend that you print a copy of these Legal Terms for your records.</p>
                        <p className="legal-note">
                            Product-specific rules also apply:{' '}
                            <Link to="/terms/ride">Ride Booking Terms</Link>,{' '}
                            <Link to="/terms/rental">Rental Terms</Link>, and{' '}
                            <Link to="/terms/listing">Host Listing Terms</Link>.
                        </p>
                    </section>

                    <nav className="legal-toc" aria-label="Table of contents">
                        <h2>Table of Contents</h2>
                        <ol>
                            {TOC.map((item) => (
                                <li key={item.id}>
                                    <a href={`#${item.id}`}>{item.label.replace(/^\d+\.\s*/, '')}</a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    <section className="legal-section" id="services">
                        <h2>1. Our Services</h2>
                        <p>
                            The information provided when using the Services is not intended for distribution to or
                            use by any person or entity in any jurisdiction or country where such distribution or use
                            would be contrary to law or regulation or which would subject us to any registration
                            requirement within such jurisdiction or country. Accordingly, those persons who choose to
                            access the Services from other locations do so on their own initiative and are solely
                            responsible for compliance with local laws, if and to the extent local laws are applicable.
                        </p>
                        <p>
                            The Services are not tailored to comply with industry-specific regulations (Health
                            Insurance Portability and Accountability Act (HIPAA), Federal Information Security
                            Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you
                            may not use the Services. You may not use the Services in a way that would violate the
                            Gramm-Leach-Bliley Act (GLBA).
                        </p>
                    </section>

                    <section className="legal-section" id="ip">
                        <h2>2. Intellectual Property Rights</h2>
                        <h3>Our intellectual property</h3>
                        <p>
                            We are the owner or the licensee of all intellectual property rights in our Services,
                            including all source code, databases, functionality, software, website designs, audio,
                            video, text, photographs, and graphics in the Services (collectively, the
                            &quot;Content&quot;), as well as the trademarks, service marks, and logos contained therein
                            (the &quot;Marks&quot;).
                        </p>
                        <p>
                            Our Content and Marks are protected by copyright and trademark laws (and various other
                            intellectual property rights and unfair competition laws) and treaties around the world.
                        </p>
                        <p>
                            The Content and Marks are provided in or through the Services &quot;AS IS&quot; for your
                            personal, non-commercial use or internal business purpose only.
                        </p>
                        <h3>Your use of our Services</h3>
                        <p>
                            Subject to your compliance with these Legal Terms, including the{' '}
                            <a href="#prohibited">PROHIBITED ACTIVITIES</a> section below, we grant you a
                            non-exclusive, non-transferable, revocable license to:
                        </p>
                        <ul>
                            <li>access the Services; and</li>
                            <li>download or print a copy of any portion of the Content to which you have properly gained access,</li>
                        </ul>
                        <p>
                            solely for your personal, non-commercial use or internal business purpose.
                        </p>
                        <p>
                            Except as set out in this section or elsewhere in our Legal Terms, no part of the Services
                            and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded,
                            posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed,
                            or otherwise exploited for any commercial purpose whatsoever, without our express prior
                            written permission.
                        </p>
                        <p>
                            If you wish to make any use of the Services, Content, or Marks other than as set out in
                            this section or elsewhere in our Legal Terms, please address your request to:{' '}
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                        </p>
                        <p>
                            We reserve all rights not expressly granted to you in and to the Services, Content, and
                            Marks. Any breach of these Intellectual Property Rights will constitute a material breach
                            of our Legal Terms and your right to use our Services will terminate immediately.
                        </p>
                        <h3>Your submissions and contributions</h3>
                        <p>
                            Please review this section and the <a href="#prohibited">PROHIBITED ACTIVITIES</a> section
                            carefully prior to using our Services to understand the (a) rights you give us and (b)
                            obligations you have when you post or upload any content through the Services.
                        </p>
                        <p>
                            <strong>Submissions:</strong> By directly sending us any question, comment, suggestion,
                            idea, feedback, or other information about the Services (&quot;Submissions&quot;), you
                            agree to assign to us all intellectual property rights in such Submission. You agree that
                            we shall own this Submission and be entitled to its unrestricted use and dissemination for
                            any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.
                        </p>
                        <p>
                            <strong>Contributions:</strong> The Services may invite you to chat, contribute to, or
                            participate in forums and other functionality during which you may create, submit, post,
                            display, transmit, publish, distribute, or broadcast content and materials to us or through
                            the Services, including but not limited to text, writings, video, audio, photographs,
                            graphics, comments, reviews, rating suggestions, personal information, or other material
                            (&quot;Contributions&quot;). Any Submission that is publicly posted shall also be treated
                            as a Contribution.
                        </p>
                        <p>
                            You understand that Contributions may be viewable by other users of the Services and
                            possibly through third-party websites.
                        </p>
                        <p>
                            <strong>When you post Contributions, you grant us a license:</strong> By posting any
                            Contributions, you grant us an unrestricted, unlimited, irrevocable, perpetual,
                            non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to use,
                            copy, reproduce, distribute, sell, resell, publish, broadcast, retitle, store, publicly
                            perform, publicly display, reformat, translate, excerpt (in whole or in part), and exploit
                            your Contributions (including, without limitation, your image, name, and voice) for any
                            purpose, commercial, advertising, or otherwise, to prepare derivative works of, or
                            incorporate into other works, your Contributions, and to sublicense the licenses granted in
                            this section.
                        </p>
                        <p>
                            <strong>You are responsible for what you post or upload.</strong> You are solely
                            responsible for your Submissions and/or Contributions and you expressly agree to reimburse
                            us for any and all losses that we may suffer because of your breach of (a) this section,
                            (b) any third party&apos;s intellectual property rights, or (c) applicable law.
                        </p>
                        <p>
                            <strong>We may remove or edit your Content:</strong> Although we have no obligation to
                            monitor any Contributions, we shall have the right to remove or edit any Contributions at
                            any time without notice if in our reasonable opinion we consider such Contributions harmful
                            or in breach of these Legal Terms.
                        </p>
                        <h3>Copyright infringement</h3>
                        <p>
                            We respect the intellectual property rights of others. If you believe that any material
                            available on or through the Services infringes upon any copyright you own or control,
                            please immediately refer to the{' '}
                            <a href="#copyrightyes">COPYRIGHT INFRINGEMENTS</a> section below.
                        </p>
                    </section>

                    <section className="legal-section" id="userreps">
                        <h2>3. User Representations</h2>
                        <p>By using the Services, you represent and warrant that:</p>
                        <ol>
                            <li>all registration information you submit will be true, accurate, current, and complete;</li>
                            <li>you will maintain the accuracy of such information and promptly update such registration information as necessary;</li>
                            <li>you have the legal capacity and you agree to comply with these Legal Terms;</li>
                            <li>you are not under the age of 13;</li>
                            <li>you are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services;</li>
                            <li>you will not access the Services through automated or non-human means, whether through a bot, script or otherwise;</li>
                            <li>you will not use the Services for any illegal or unauthorized purpose; and</li>
                            <li>your use of the Services will not violate any applicable law or regulation.</li>
                        </ol>
                        <p>
                            If you provide any information that is untrue, inaccurate, not current, or incomplete, we
                            have the right to suspend or terminate your account and refuse any and all current or
                            future use of the Services (or any portion thereof).
                        </p>
                    </section>

                    <section className="legal-section" id="userreg">
                        <h2>4. User Registration</h2>
                        <p>
                            You may be required to register to use the Services. You agree to keep your password and
                            authentication credentials confidential and will be responsible for all use of your
                            account. We reserve the right to remove, reclaim, or change a username you select if we
                            determine, in our sole discretion, that such username is inappropriate, obscene, or
                            otherwise objectionable.
                        </p>
                    </section>

                    <section className="legal-section" id="purchases">
                        <h2>5. Purchases and Payment</h2>
                        <p>We accept the following forms of payment:</p>
                        <ul>
                            <li>Visa</li>
                            <li>Mastercard</li>
                            <li>UPI</li>
                            <li>In-app wallet top-ups processed via Cashfree</li>
                        </ul>
                        <p>
                            You agree to provide current, complete, and accurate purchase and account information for
                            all purchases made via the Services. You further agree to promptly update account and
                            payment information, including email address, payment method, and payment card expiration
                            date, so that we can complete your transactions and contact you as needed. Applicable taxes
                            may be added to the price of purchases as required. We may change prices at any time. All
                            payments shall be in <strong>Indian Rupees (INR)</strong>.
                        </p>
                        <p>
                            You agree to pay all charges at the prices then in effect for your purchases, and you
                            authorize us to charge your chosen payment provider for any such amounts upon placing your
                            order. We reserve the right to correct any errors or mistakes in pricing, even if we have
                            already requested or received payment.
                        </p>
                        <p>
                            We reserve the right to refuse any order placed through the Services. We may, in our sole
                            discretion, limit or cancel quantities purchased per person, per household, or per order.
                        </p>
                    </section>

                    <section className="legal-section" id="software">
                        <h2>6. Software</h2>
                        <p>
                            We may include software for use in connection with our Services. If such software is
                            accompanied by an end user license agreement (&quot;EULA&quot;), the terms of the EULA will
                            govern your use of the software. If such software is not accompanied by a EULA, then we
                            grant to you a non-exclusive, revocable, personal, and non-transferable license to use such
                            software solely in connection with our services and in accordance with these Legal Terms.
                            Any software and any related documentation is provided &quot;AS IS&quot; without warranty
                            of any kind. You may not reproduce or redistribute any software except in accordance with
                            the EULA or these Legal Terms.
                        </p>
                    </section>

                    <section className="legal-section" id="prohibited">
                        <h2>7. Prohibited Activities</h2>
                        <p>
                            You may not access or use the Services for any purpose other than that for which we make
                            the Services available. The Services may not be used in connection with any commercial
                            endeavors except those that are specifically endorsed or approved by us (including
                            legitimate host vehicle listings on PackAndSync).
                        </p>
                        <p>As a user of the Services, you agree not to:</p>
                        <ul>
                            <li>Systematically retrieve data or other content from the Services to create or compile a collection, compilation, database, or directory without written permission from us.</li>
                            <li>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information.</li>
                            <li>Circumvent, disable, or otherwise interfere with security-related features of the Services.</li>
                            <li>Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.</li>
                            <li>Use any information obtained from the Services in order to harass, abuse, or harm another person.</li>
                            <li>Make improper use of our support services or submit false reports of abuse or misconduct.</li>
                            <li>Use the Services in a manner inconsistent with any applicable laws or regulations.</li>
                            <li>Engage in unauthorized framing of or linking to the Services.</li>
                            <li>Upload or transmit viruses, Trojan horses, or other material that interferes with any party&apos;s uninterrupted use and enjoyment of the Services.</li>
                            <li>Engage in any automated use of the system, such as using scripts, data mining, robots, or similar tools, except as permitted by us.</li>
                            <li>Delete the copyright or other proprietary rights notice from any Content.</li>
                            <li>Attempt to impersonate another user or person or use the username of another user.</li>
                            <li>Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.</li>
                            <li>Harass, annoy, intimidate, or threaten any of our employees or agents.</li>
                            <li>Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services.</li>
                            <li>Copy or adapt the Services&apos; software, including but not limited to HTML, JavaScript, or other code.</li>
                            <li>Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.</li>
                            <li>Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.</li>
                            <li>Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any unauthorized revenue-generating endeavor or commercial enterprise.</li>
                            <li>Use the Services to advertise or offer to sell goods and services outside of features we expressly provide (such as approved host listings).</li>
                        </ul>
                    </section>

                    <section className="legal-section" id="ugc">
                        <h2>8. User Generated Contributions</h2>
                        <p>
                            The Services may invite you to chat, contribute to, or participate in forums and other
                            functionality, and may provide you with the opportunity to create, submit, post, display,
                            transmit, perform, publish, distribute, or broadcast content and materials to us or on the
                            Services, including but not limited to text, writings, video, audio, photographs, graphics,
                            comments, suggestions, profile photos, vehicle photos, verification documents, or personal
                            information or other material (collectively, &quot;Contributions&quot;). Contributions may
                            be viewable by other users of the Services and through third-party websites. As such, any
                            Contributions you transmit may be treated as non-confidential and non-proprietary. When you
                            create or make available any Contributions, you thereby represent and warrant that:
                        </p>
                        <ul>
                            <li>The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights of any third party.</li>
                            <li>You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.</li>
                            <li>You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person.</li>
                            <li>Your Contributions are not false, inaccurate, or misleading.</li>
                            <li>Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.</li>
                            <li>Your Contributions are not obscene, lewd, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).</li>
                            <li>Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.</li>
                            <li>Your Contributions are not used to harass or threaten any other person or to promote violence against a specific person or class of people.</li>
                            <li>Your Contributions do not violate any applicable law, regulation, or rule.</li>
                            <li>Your Contributions do not violate the privacy or publicity rights of any third party.</li>
                            <li>Your Contributions do not violate any applicable law concerning child pornography, or otherwise intended to protect the health or well-being of minors.</li>
                            <li>Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.</li>
                            <li>Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.</li>
                        </ul>
                        <p>
                            Any use of the Services in violation of the foregoing violates these Legal Terms and may
                            result in, among other things, termination or suspension of your rights to use the Services.
                        </p>
                    </section>

                    <section className="legal-section" id="license">
                        <h2>9. Contribution License</h2>
                        <p>
                            By posting your Contributions to any part of the Services, you automatically grant, and you
                            represent and warrant that you have the right to grant, to us an unrestricted, unlimited,
                            irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide
                            right, and license to host, use, copy, reproduce, disclose, sell, resell, publish,
                            broadcast, retitle, archive, store, cache, publicly perform, publicly display, reformat,
                            translate, transmit, excerpt (in whole or in part), and distribute such Contributions
                            (including, without limitation, your image and voice) for any purpose, commercial,
                            advertising, or otherwise, and to prepare derivative works of, or incorporate into other
                            works, such Contributions, and grant and authorize sublicenses of the foregoing.
                        </p>
                        <p>
                            This license will apply to any form, media, or technology now known or hereafter developed.
                            You waive all moral rights in your Contributions, and you warrant that moral rights have
                            not otherwise been asserted in your Contributions.
                        </p>
                        <p>
                            We do not assert any ownership over your Contributions. You retain full ownership of all of
                            your Contributions and any intellectual property rights or other proprietary rights
                            associated with your Contributions. We are not liable for any statements or representations
                            in your Contributions. You are solely responsible for your Contributions to the Services.
                        </p>
                        <p>
                            We have the right, in our sole and absolute discretion, (1) to edit, redact, or otherwise
                            change any Contributions; (2) to re-categorize any Contributions; and (3) to pre-screen or
                            delete any Contributions at any time and for any reason, without notice. We have no
                            obligation to monitor your Contributions.
                        </p>
                    </section>

                    <section className="legal-section" id="reviews">
                        <h2>10. Guidelines for Reviews</h2>
                        <p>
                            We may provide you areas on the Services to leave reviews or ratings. When posting a
                            review, you must comply with the following criteria: (1) you should have firsthand
                            experience with the person/entity being reviewed; (2) your reviews should not contain
                            offensive profanity, or abusive, racist, offensive, or hateful language; (3) your reviews
                            should not contain discriminatory references based on religion, race, gender, national
                            origin, age, marital status, sexual orientation, or disability; (4) your reviews should not
                            contain references to illegal activity; (5) you should not be affiliated with competitors
                            if posting negative reviews; (6) you should not make any conclusions as to the legality of
                            conduct; (7) you may not post any false or misleading statements; and (8) you may not
                            organize a campaign encouraging others to post reviews, whether positive or negative.
                        </p>
                        <p>
                            We may accept, reject, or remove reviews in our sole discretion. Reviews are not endorsed
                            by us, and do not necessarily represent our opinions. By posting a review, you hereby grant
                            to us a perpetual, non-exclusive, worldwide, royalty-free, fully paid, assignable, and
                            sublicensable right and license to reproduce, modify, translate, transmit by any means,
                            display, perform, and/or distribute all content relating to review.
                        </p>
                    </section>

                    <section className="legal-section" id="mobile">
                        <h2>11. Mobile Application License</h2>
                        <h3>Use License</h3>
                        <p>
                            If you access the Services via the App, then we grant you a revocable, non-exclusive,
                            non-transferable, limited right to install and use the App on wireless electronic devices
                            owned or controlled by you, and to access and use the App on such devices strictly in
                            accordance with the terms and conditions of this mobile application license contained in
                            these Legal Terms.
                        </p>
                        <h3>Apple and Android Devices</h3>
                        <p>
                            The following terms apply when you use the App obtained from either the Apple Store or
                            Google Play (each an &quot;App Distributor&quot;) to access the Services: (1) the license
                            granted to you for our App is limited to a non-transferable license to use the application
                            on a device that utilizes the Apple iOS or Android operating systems, as applicable, and in
                            accordance with the usage rules set forth in the applicable App Distributor&apos;s terms of
                            service; (2) we are responsible for providing any maintenance and support services with
                            respect to the App as specified in these Legal Terms or as otherwise required under
                            applicable law, and you acknowledge that each App Distributor has no obligation whatsoever
                            to furnish any maintenance and support services with respect to the App; (3) in the event
                            of any failure of the App to conform to any applicable warranty, you may notify the
                            applicable App Distributor, and the App Distributor, in accordance with its terms and
                            policies, may refund the purchase price, if any, paid for the App; (4) you represent and
                            warrant that (i) you are not located in a country that is subject to a US government embargo,
                            or that has been designated by the US government as a &quot;terrorist supporting&quot;
                            country and (ii) you are not listed on any US government list of prohibited or restricted
                            parties; (5) you must comply with applicable third-party terms of agreement when using the
                            App; and (6) you acknowledge and agree that the App Distributors are third-party
                            beneficiaries of the terms and conditions in this mobile application license contained in
                            these Legal Terms.
                        </p>
                    </section>

                    <section className="legal-section" id="thirdparty">
                        <h2>12. Third-Party Websites and Content</h2>
                        <p>
                            The Services may contain (or you may be sent via the Site or App) links to other websites
                            (&quot;Third-Party Websites&quot;) as well as articles, photographs, text, graphics,
                            pictures, designs, music, sound, video, information, applications, software, and other
                            content or items belonging to or originating from third parties (&quot;Third-Party
                            Content&quot;). Such Third-Party Websites and Third-Party Content are not investigated,
                            monitored, or checked for accuracy, appropriateness, or completeness by us, and we are not
                            responsible for any Third-Party Websites accessed through the Services or any Third-Party
                            Content posted on, available through, or installed from the Services. Inclusion of, linking
                            to, or permitting the use or installation of any Third-Party Websites or any Third-Party
                            Content does not imply approval or endorsement thereof by us. If you decide to leave the
                            Services and access the Third-Party Websites or to use or install any Third-Party Content,
                            you do so at your own risk, and you should be aware these Legal Terms no longer govern.
                        </p>
                    </section>

                    <section className="legal-section" id="sitemanage">
                        <h2>13. Services Management</h2>
                        <p>
                            We reserve the right, but not the obligation, to: (1) monitor the Services for violations
                            of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole
                            discretion, violates the law or these Legal Terms, including without limitation, reporting
                            such user to law enforcement authorities; (3) in our sole discretion and without limitation,
                            refuse, restrict access to, limit the availability of, or disable (to the extent
                            technologically feasible) any of your Contributions or any portion thereof; (4) in our sole
                            discretion and without limitation, notice, or liability, to remove from the Services or
                            otherwise disable all files and content that are excessive in size or are in any way
                            burdensome to our systems; and (5) otherwise manage the Services in a manner designed to
                            protect our rights and property and to facilitate the proper functioning of the Services.
                        </p>
                    </section>

                    <section className="legal-section" id="ppyes">
                        <h2>14. Privacy Policy</h2>
                        <p>
                            We care about data privacy and security. Please review our Privacy Policy:{' '}
                            <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{PRIVACY_URL}</a>
                            {' '}(also available at <Link to="/privacy-policy">/privacy-policy</Link>). By using the
                            Services, you agree to be bound by our Privacy Policy, which is incorporated into these
                            Legal Terms. Please be advised the Services are hosted in <strong>India</strong>. If you
                            access the Services from any other region of the world with laws or other requirements
                            governing personal data collection, use, or disclosure that differ from applicable laws in
                            India, then through your continued use of the Services, you are transferring your data to
                            India, and you expressly consent to have your data transferred to and processed in India.
                        </p>
                        <p>
                            Further, we do not knowingly accept, request, or solicit information from children or
                            knowingly market to children. Therefore, in accordance with the U.S. Children&apos;s Online
                            Privacy Protection Act, if we receive actual knowledge that anyone under the age of 13 has
                            provided personal information to us without the requisite and verifiable parental consent,
                            we will delete that information from the Services as quickly as is reasonably practical.
                        </p>
                    </section>

                    <section className="legal-section" id="copyrightyes">
                        <h2>15. Copyright Infringements</h2>
                        <p>
                            We respect the intellectual property rights of others. If you believe that any material
                            available on or through the Services infringes upon any copyright you own or control,
                            please immediately notify us using the contact information provided below (a
                            &quot;Notification&quot;). A copy of your Notification will be sent to the person who
                            posted or stored the material addressed in the Notification. Please be advised that pursuant
                            to applicable law you may be held liable for damages if you make material
                            misrepresentations in a Notification. Thus, if you are not sure that material located on or
                            linked to by the Services infringes your copyright, you should consider first contacting an
                            attorney.
                        </p>
                    </section>

                    <section className="legal-section" id="terms">
                        <h2>16. Term and Termination</h2>
                        <p>
                            These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT
                            LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE
                            DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES
                            (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON,
                            INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT
                            CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE
                            YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY CONTENT OR
                            INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.
                        </p>
                        <p>
                            If we terminate or suspend your account for any reason, you are prohibited from registering
                            and creating a new account under your name, a fake or borrowed name, or the name of any
                            third party, even if you may be acting on behalf of the third party. In addition to
                            terminating or suspending your account, we reserve the right to take appropriate legal
                            action, including without limitation pursuing civil, criminal, and injunctive redress.
                        </p>
                    </section>

                    <section className="legal-section" id="modifications">
                        <h2>17. Modifications and Interruptions</h2>
                        <p>
                            We reserve the right to change, modify, or remove the contents of the Services at any time
                            or for any reason at our sole discretion without notice. However, we have no obligation to
                            update any information on our Services. We will not be liable to you or any third party for
                            any modification, price change, suspension, or discontinuance of the Services.
                        </p>
                        <p>
                            We cannot guarantee the Services will be available at all times. We may experience hardware,
                            software, or other problems or need to perform maintenance related to the Services,
                            resulting in interruptions, delays, or errors. You agree that we have no liability
                            whatsoever for any loss, damage, or inconvenience caused by your inability to access or use
                            the Services during any downtime or discontinuance of the Services.
                        </p>
                    </section>

                    <section className="legal-section" id="law">
                        <h2>18. Governing Law</h2>
                        <p>
                            These Legal Terms shall be governed by and defined following the laws of{' '}
                            <strong>India</strong>. {COMPANY} and yourself irrevocably consent that the courts of{' '}
                            <strong>Haryana, India</strong> shall have exclusive jurisdiction to resolve any dispute
                            which may arise in connection with these Legal Terms.
                        </p>
                    </section>

                    <section className="legal-section" id="disputes">
                        <h2>19. Dispute Resolution</h2>
                        <p>
                            You agree to irrevocably submit all disputes related to these Legal Terms or the legal
                            relationship established by these Legal Terms to the jurisdiction of the courts of{' '}
                            <strong>Haryana, India</strong>. {COMPANY} shall also maintain the right to bring
                            proceedings as to the substance of the matter in the courts of the country where you reside
                            or, if these Legal Terms are entered into in the course of your trade or profession, the
                            state of your principal place of business.
                        </p>
                    </section>

                    <section className="legal-section" id="corrections">
                        <h2>20. Corrections</h2>
                        <p>
                            There may be information on the Services that contains typographical errors, inaccuracies,
                            or omissions, including descriptions, pricing, availability, and various other information.
                            We reserve the right to correct any errors, inaccuracies, or omissions and to change or
                            update the information on the Services at any time, without prior notice.
                        </p>
                    </section>

                    <section className="legal-section" id="disclaimer">
                        <h2>21. Disclaimer</h2>
                        <p className="legal-caps">
                            THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF
                            THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM
                            ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF,
                            INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                            PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT
                            THE ACCURACY OR COMPLETENESS OF THE SERVICES&apos; CONTENT OR THE CONTENT OF ANY WEBSITES OR
                            MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY
                            FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY
                            OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE
                            SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL
                            PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR
                            CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR
                            THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6)
                            ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND
                            INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE
                            AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY
                            FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY
                            HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER
                            ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY
                            TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES.
                        </p>
                    </section>

                    <section className="legal-section" id="liability">
                        <h2>22. Limitations of Liability</h2>
                        <p className="legal-caps">
                            IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD
                            PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE
                            DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM
                            YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                            NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY
                            CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO
                            THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD PRIOR TO ANY CAUSE OF
                            ACTION ARISING. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON
                            IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY
                            TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU
                            MAY HAVE ADDITIONAL RIGHTS.
                        </p>
                    </section>

                    <section className="legal-section" id="indemnification">
                        <h2>23. Indemnification</h2>
                        <p>
                            You agree to defend, indemnify, and hold us harmless, including our subsidiaries,
                            affiliates, and all of our respective officers, agents, partners, and employees, from and
                            against any loss, damage, liability, claim, or demand, including reasonable attorneys&apos;
                            fees and expenses, made by any third party due to or arising out of: (1) your Contributions;
                            (2) use of the Services; (3) breach of these Legal Terms; (4) any breach of your
                            representations and warranties set forth in these Legal Terms; (5) your violation of the
                            rights of a third party, including but not limited to intellectual property rights; or (6)
                            any overt harmful act toward any other user of the Services with whom you connected via the
                            Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume
                            the exclusive defense and control of any matter for which you are required to indemnify us,
                            and you agree to cooperate, at your expense, with our defense of such claims.
                        </p>
                    </section>

                    <section className="legal-section" id="userdata">
                        <h2>24. User Data</h2>
                        <p>
                            We will maintain certain data that you transmit to the Services for the purpose of managing
                            the performance of the Services, as well as data relating to your use of the Services.
                            Although we perform regular routine backups of data, you are solely responsible for all
                            data that you transmit or that relates to any activity you have undertaken using the
                            Services. You agree that we shall have no liability to you for any loss or corruption of
                            any such data, and you hereby waive any right of action against us arising from any such
                            loss or corruption of such data.
                        </p>
                    </section>

                    <section className="legal-section" id="electronic">
                        <h2>25. Electronic Communications, Transactions, and Signatures</h2>
                        <p>
                            Visiting the Services, sending us emails, and completing online forms constitute electronic
                            communications. You consent to receive electronic communications, and you agree that all
                            agreements, notices, disclosures, and other communications we provide to you electronically,
                            via email and on the Services, satisfy any legal requirement that such communication be in
                            writing. YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER
                            RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS
                            INITIATED OR COMPLETED BY US OR VIA THE SERVICES.
                        </p>
                    </section>

                    <section className="legal-section" id="california">
                        <h2>26. California Users and Residents</h2>
                        <p>
                            If any complaint with us is not satisfactorily resolved, you can contact the Complaint
                            Assistance Unit of the Division of Consumer Services of the California Department of
                            Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California
                            95834 or by telephone at (800) 952-5210 or (916) 445-1254.
                        </p>
                    </section>

                    <section className="legal-section" id="misc">
                        <h2>27. Miscellaneous</h2>
                        <p>
                            These Legal Terms and any policies or operating rules posted by us on the Services or in
                            respect to the Services constitute the entire agreement and understanding between you and
                            us. Our failure to exercise or enforce any right or provision of these Legal Terms shall
                            not operate as a waiver of such right or provision. These Legal Terms operate to the fullest
                            extent permissible by law. We may assign any or all of our rights and obligations to others
                            at any time. We shall not be responsible or liable for any loss, damage, delay, or failure
                            to act caused by any cause beyond our reasonable control. If any provision or part of a
                            provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that
                            provision or part of the provision is deemed severable from these Legal Terms and does not
                            affect the validity and enforceability of any remaining provisions. There is no joint
                            venture, partnership, employment or agency relationship created between you and us as a
                            result of these Legal Terms or use of the Services. You agree that these Legal Terms will
                            not be construed against us by virtue of having drafted them. You hereby waive any and all
                            defenses you may have based on the electronic form of these Legal Terms and the lack of
                            signing by the parties hereto to execute these Legal Terms.
                        </p>
                    </section>

                    <section className="legal-section" id="contact">
                        <h2>28. Contact Us</h2>
                        <p>
                            In order to resolve a complaint regarding the Services or to receive further information
                            regarding use of the Services, please contact us at:
                        </p>
                        <address className="legal-address">
                            <strong>{COMPANY}</strong>
                            <br />
                            Haryana, India
                            <br />
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                        </address>
                    </section>
                </article>
            </div>
        </div>
    );
}
