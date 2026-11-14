// ─── UserAvatar.jsx – Cartoon Face Avatars ─────────────────────────────────

function FaceSVG({ skinTone, hairColor, hairStyle, shirtColor, hasGlasses = false, hasBow = false, isWoman = false }) {
  const browColor = hairColor === '#f5c518' || hairColor === '#D4A017' ? '#8B6914' : hairColor;
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Shirt / body */}
      <rect x="15" y="80" width="70" height="25" rx="6" fill={shirtColor} />
      <ellipse cx="50" cy="80" rx="22" ry="8" fill={shirtColor} />

      {/* Neck */}
      <rect x="43" y="69" width="14" height="14" rx="4" fill={skinTone} />

      {/* Head */}
      <ellipse cx="50" cy="52" rx="22" ry="24" fill={skinTone} />

      {/* Ears */}
      <ellipse cx="28.5" cy="54" rx="4" ry="5" fill={skinTone} />
      <ellipse cx="71.5" cy="54" rx="4" ry="5" fill={skinTone} />

      {/* Hair */}
      {hairStyle === 'short' && (
        <>
          <ellipse cx="50" cy="31" rx="22" ry="13" fill={hairColor} />
          <rect x="28" y="30" width="44" height="8" fill={hairColor} />
        </>
      )}
      {hairStyle === 'curly' && (
        <>
          <ellipse cx="50" cy="29" rx="23" ry="13" fill={hairColor} />
          <circle cx="30" cy="34" r="8" fill={hairColor} />
          <circle cx="70" cy="34" r="8" fill={hairColor} />
          <circle cx="50" cy="26" r="8" fill={hairColor} />
          <circle cx="38" cy="28" r="7" fill={hairColor} />
          <circle cx="62" cy="28" r="7" fill={hairColor} />
          <rect x="28" y="30" width="44" height="8" fill={hairColor} />
        </>
      )}
      {hairStyle === 'bald' && (
        <ellipse cx="50" cy="30" rx="22" ry="10" fill={hairColor} opacity="0.25" />
      )}
      {hairStyle === 'long' && (
        <>
          <ellipse cx="50" cy="29" rx="23" ry="13" fill={hairColor} />
          <rect x="27" y="30" width="8" height="32" rx="4" fill={hairColor} />
          <rect x="65" y="30" width="8" height="32" rx="4" fill={hairColor} />
          <rect x="28" y="30" width="44" height="8" fill={hairColor} />
        </>
      )}
      {hairStyle === 'ponytail' && (
        <>
          <ellipse cx="50" cy="29" rx="23" ry="13" fill={hairColor} />
          <rect x="28" y="30" width="44" height="8" fill={hairColor} />
          <ellipse cx="68" cy="40" rx="5" ry="11" fill={hairColor} transform="rotate(20 68 40)" />
        </>
      )}
      {hairStyle === 'afro' && (
        <>
          <circle cx="50" cy="30" r="27" fill={hairColor} />
          <rect x="28" y="30" width="44" height="10" fill={hairColor} />
        </>
      )}

      {/* Bow accessory */}
      {hasBow && (
        <g transform="translate(55, 23)">
          <ellipse cx="-7" cy="0" rx="6" ry="4.5" fill="#ff6b8a" transform="rotate(-25 -7 0)" />
          <ellipse cx="7" cy="0" rx="6" ry="4.5" fill="#ff6b8a" transform="rotate(25 7 0)" />
          <circle cx="0" cy="0" r="3.5" fill="#ff4d75" />
        </g>
      )}

      {/* Eyes */}
      <circle cx="41" cy="53" r="3.5" fill="white" />
      <circle cx="59" cy="53" r="3.5" fill="white" />
      <circle cx="42" cy="53.5" r="2" fill="#333" />
      <circle cx="60" cy="53.5" r="2" fill="#333" />
      <circle cx="43" cy="52.5" r="0.8" fill="white" />
      <circle cx="61" cy="52.5" r="0.8" fill="white" />

      {/* Eyebrows */}
      <path d={isWoman ? 'M 37 48.5 Q 41 47 45 48.5' : 'M 37 48 Q 41 46.5 45 48'}
        stroke={browColor} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d={isWoman ? 'M 55 48.5 Q 59 47 63 48.5' : 'M 55 48 Q 59 46.5 63 48'}
        stroke={browColor} strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* Glasses */}
      {hasGlasses && (
        <g stroke="#555" strokeWidth="1.5" fill="none">
          <rect x="35" y="49.5" width="12" height="9" rx="3" />
          <rect x="53" y="49.5" width="12" height="9" rx="3" />
          <line x1="47" y1="54" x2="53" y2="54" />
          <line x1="28" y1="52" x2="35" y2="53" />
          <line x1="65" y1="53" x2="72" y2="52" />
        </g>
      )}

      {/* Nose */}
      <path d="M 50 56 Q 47 61 50 63 Q 53 61 50 56"
        fill={skinTone}
        stroke={skinTone === '#FDDCB5' || skinTone === '#E8C49A' ? '#d4956a' : '#a0633a'}
        strokeWidth="0.8" />

      {/* Smile */}
      <path d="M 43 67 Q 50 73 57 67" stroke="#c0392b" strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* Cheek blush */}
      <ellipse cx="36" cy="62" rx="5" ry="3" fill="#ff9999" opacity="0.3" />
      <ellipse cx="64" cy="62" rx="5" ry="3" fill="#ff9999" opacity="0.3" />
    </svg>
  );
}

// ─── Avatar Catalogue ────────────────────────────────────────────────────────

export const ANIMATED_AVATARS = {
  men: [
    {
      id: 'avatar:man_1',
      name: 'Alex',
      badge: 'Explorer',
      bgColor: '#E8F4FF',
      skinTone: '#FDDCB5',
      hairColor: '#3B1F0A',
      hairStyle: 'short',
      shirtColor: '#3B82F6',
      hasGlasses: false,
      ringColor: 'border-blue-400',
      glowColor: 'rgba(59,130,246,0.4)',
    },
    {
      id: 'avatar:man_2',
      name: 'Marcus',
      badge: 'Creator',
      bgColor: '#E8FFE8',
      skinTone: '#7B4F27',
      hairColor: '#1A0A00',
      hairStyle: 'curly',
      shirtColor: '#16A34A',
      hasGlasses: false,
      ringColor: 'border-green-400',
      glowColor: 'rgba(22,163,74,0.4)',
    },
    {
      id: 'avatar:man_3',
      name: 'James',
      badge: 'Scholar',
      bgColor: '#FFF5E8',
      skinTone: '#E8C49A',
      hairColor: '#D4A017',
      hairStyle: 'bald',
      shirtColor: '#F97316',
      hasGlasses: true,
      ringColor: 'border-orange-400',
      glowColor: 'rgba(249,115,22,0.4)',
    },
    {
      id: 'avatar:man_4',
      name: 'Daniel',
      badge: 'Pioneer',
      bgColor: '#F0E8FF',
      skinTone: '#5C3010',
      hairColor: '#0D0806',
      hairStyle: 'short',
      shirtColor: '#7C3AED',
      hasGlasses: true,
      ringColor: 'border-purple-400',
      glowColor: 'rgba(124,58,237,0.4)',
    },
    {
      id: 'avatar:man_5',
      name: 'Ethan',
      badge: 'Innovator',
      bgColor: '#E8FFFF',
      skinTone: '#FDDCB5',
      hairColor: '#8B4513',
      hairStyle: 'curly',
      shirtColor: '#0891B2',
      hasGlasses: false,
      ringColor: 'border-cyan-400',
      glowColor: 'rgba(8,145,178,0.4)',
    },
    {
      id: 'avatar:man_6',
      name: 'Leo',
      badge: 'Visionary',
      bgColor: '#FFF0F0',
      skinTone: '#C68642',
      hairColor: '#1A0A00',
      hairStyle: 'afro',
      shirtColor: '#DC2626',
      hasGlasses: false,
      ringColor: 'border-red-400',
      glowColor: 'rgba(220,38,38,0.4)',
    },
  ],
  women: [
    {
      id: 'avatar:woman_1',
      name: 'Sophia',
      badge: 'Luminary',
      bgColor: '#FFE8F5',
      skinTone: '#FDDCB5',
      hairColor: '#3B1F0A',
      hairStyle: 'long',
      shirtColor: '#EC4899',
      hasBow: false,
      hasGlasses: false,
      isWoman: true,
      ringColor: 'border-pink-400',
      glowColor: 'rgba(236,72,153,0.4)',
    },
    {
      id: 'avatar:woman_2',
      name: 'Aisha',
      badge: 'Trailblazer',
      bgColor: '#F5E8FF',
      skinTone: '#7B4F27',
      hairColor: '#1A0A00',
      hairStyle: 'afro',
      shirtColor: '#7C3AED',
      hasBow: true,
      hasGlasses: false,
      isWoman: true,
      ringColor: 'border-violet-400',
      glowColor: 'rgba(124,58,237,0.4)',
    },
    {
      id: 'avatar:woman_3',
      name: 'Emma',
      badge: 'Dreamweaver',
      bgColor: '#E8F5FF',
      skinTone: '#E8C49A',
      hairColor: '#f5c518',
      hairStyle: 'ponytail',
      shirtColor: '#3B82F6',
      hasBow: false,
      hasGlasses: false,
      isWoman: true,
      ringColor: 'border-blue-400',
      glowColor: 'rgba(59,130,246,0.4)',
    },
    {
      id: 'avatar:woman_4',
      name: 'Priya',
      badge: 'Sage',
      bgColor: '#E8FFE8',
      skinTone: '#C68642',
      hairColor: '#1A0A00',
      hairStyle: 'long',
      shirtColor: '#16A34A',
      hasBow: true,
      hasGlasses: true,
      isWoman: true,
      ringColor: 'border-emerald-400',
      glowColor: 'rgba(16,185,129,0.4)',
    },
    {
      id: 'avatar:woman_5',
      name: 'Zoe',
      badge: 'Creator',
      bgColor: '#FFFDE8',
      skinTone: '#FDDCB5',
      hairColor: '#8B0000',
      hairStyle: 'curly',
      shirtColor: '#F59E0B',
      hasBow: false,
      hasGlasses: false,
      isWoman: true,
      ringColor: 'border-amber-400',
      glowColor: 'rgba(245,158,11,0.4)',
    },
    {
      id: 'avatar:woman_6',
      name: 'Nadia',
      badge: 'Aurora',
      bgColor: '#FFE8E8',
      skinTone: '#5C3010',
      hairColor: '#0D0806',
      hairStyle: 'ponytail',
      shirtColor: '#DC2626',
      hasBow: true,
      hasGlasses: false,
      isWoman: true,
      ringColor: 'border-rose-400',
      glowColor: 'rgba(244,63,94,0.4)',
    },
  ],
};

export function findAvatarDef(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('avatar:')) return null;
  const all = [...ANIMATED_AVATARS.men, ...ANIMATED_AVATARS.women];
  return all.find((a) => a.id === avatarUrl) || null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function UserAvatar({ user, avatarUrl, className = 'w-9 h-9' }) {
  const effectiveUrl = avatarUrl || user?.avatarUrl;
  const initial = user?.fullName?.charAt(0)?.toUpperCase() || 'U';

  // 1. Uploaded image (base64 data: URL or remote URL)
  if (effectiveUrl && (effectiveUrl.startsWith('data:') || effectiveUrl.startsWith('http'))) {
    return (
      <div className={`relative rounded-full overflow-hidden border border-purple-400/40 shadow-sm shrink-0 ${className}`}>
        <img
          src={effectiveUrl}
          alt={user?.fullName || 'User'}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // 2. Cartoon face avatar
  if (effectiveUrl && effectiveUrl.startsWith('avatar:')) {
    const def = findAvatarDef(effectiveUrl);
    if (def) {
      const isWoman = effectiveUrl.startsWith('avatar:woman_');
      return (
        <div
          className={`relative rounded-full overflow-hidden border-2 ${def.ringColor} shrink-0 ${className}`}
          style={{ backgroundColor: def.bgColor, boxShadow: `0 0 10px ${def.glowColor}` }}
          title={def.name}
        >
          <FaceSVG
            skinTone={def.skinTone}
            hairColor={def.hairColor}
            hairStyle={def.hairStyle}
            shirtColor={def.shirtColor}
            hasGlasses={def.hasGlasses || false}
            hasBow={def.hasBow || false}
            isWoman={isWoman}
          />
        </div>
      );
    }
  }

  // 3. Default initials
  return (
    <div className={`rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-purple-400/30 ${className}`}>
      <span>{initial}</span>
    </div>
  );
}
