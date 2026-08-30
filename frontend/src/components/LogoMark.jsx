export default function LogoMark({ size = 26 }) {
    return (
        <svg
            className="navbar-logo-mark"
            width={size}
            height={size}
            viewBox="0 0 160 160"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="pns-mark-g" x1="0" y1="0" x2="160" y2="160">
                    <stop stopColor="#3b9eff" />
                    <stop offset="1" stopColor="#0066d6" />
                </linearGradient>
            </defs>
            <rect width="160" height="160" rx="36" fill="url(#pns-mark-g)" />
            <path d="M80 34c-19.9 0-36 16.1-36 36 0 26.9 36 64 36 64s36-37.1 36-64c0-19.9-16.1-36-36-36z" fill="#fff" />
            <circle cx="80" cy="70" r="15" fill="#f5b800" />
        </svg>
    );
}
