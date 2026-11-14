import { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Check,
  Loader2,
  AtSign,
  Lock,
  KeyRound,
  Upload,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar, ANIMATED_AVATARS } from './UserAvatar';

export function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarCategory, setAvatarCategory] = useState('gallery'); // 'gallery' | 'men' | 'women'
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameFeedback, setUsernameFeedback] = useState('');

  // Password change fields
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const checkTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && isOpen) {
      setFullName(user.fullName || '');
      setUsername(user.username || '');
      setAvatarUrl(user.avatarUrl || '');
      setUsernameAvailable(true);
      setUsernameFeedback('');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setError('');
      setSuccess(false);

      // Support both old IDs (avatar:man_cosmic) and new IDs (avatar:man_1 … avatar:man_6)
      if (user.avatarUrl?.startsWith('avatar:man')) {
        setAvatarCategory('men');
      } else if (user.avatarUrl?.startsWith('avatar:woman')) {
        setAvatarCategory('women');
      } else {
        setAvatarCategory('gallery');
      }
    }
  }, [user, isOpen]);

  // Gallery image file upload handler (with client-side 256x256 resizing)
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, GIF).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Image file is too large (max 15 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setAvatarUrl(dataUrl);
        setAvatarCategory('gallery');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Live availability check for username (debounced)
  const handleUsernameChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    setUsername(clean);

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (!clean) {
      setUsernameAvailable(null);
      setUsernameFeedback('');
      return;
    }

    if (clean.length < 3) {
      setUsernameAvailable(false);
      setUsernameFeedback('Must be at least 3 characters.');
      return;
    }

    if (user?.username && clean === user.username.toLowerCase()) {
      setUsernameAvailable(true);
      setUsernameFeedback('Current username');
      return;
    }

    setIsCheckingUsername(true);
    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(clean)}`);
        const data = await res.json().catch(() => ({}));
        if (data.available) {
          setUsernameAvailable(true);
          setUsernameFeedback('Username available!');
        } else {
          setUsernameAvailable(false);
          setUsernameFeedback('Username is already taken.');
        }
      } catch {
        setUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 350);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Please enter at least 2 characters for your full name.');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (usernameAvailable === false) {
      setError('Please choose an available username.');
      return;
    }

    if (showPasswordChange) {
      if (!currentPassword) {
        setError('Please enter your current password.');
        return;
      }
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError('New passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        fullName: fullName.trim(),
        username: username.trim(),
        avatarUrl,
      };
      if (showPasswordChange && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      await updateProfile(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-lg rounded-3xl bg-[#100B1E] border border-purple-500/30 shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto custom-scrollbar text-white">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header & Avatar Preview */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-purple-500/20">
          <UserAvatar
            user={{ fullName, avatarUrl }}
            avatarUrl={avatarUrl}
            className="w-16 h-16 text-xl shadow-lg ring-2 ring-purple-500/40"
          />
          <div>
            <h3 className="font-bold text-lg text-white">Edit Profile</h3>
            <p className="text-xs text-purple-300/70 truncate max-w-[260px]">{user?.email}</p>
            <span className="inline-block mt-1 text-[10px] text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/10">
              Customize appearance & security
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/30">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/30 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ========================================================
              Profile Avatar Selector (Gallery Upload + Animated Men/Women)
              ======================================================== */}
          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-2">
              Profile Avatar
            </label>

            {/* Category Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#170F2B] border border-purple-500/20 mb-3">
              <button
                type="button"
                onClick={() => setAvatarCategory('gallery')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  avatarCategory === 'gallery'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Gallery Upload
              </button>
              <button
                type="button"
                onClick={() => setAvatarCategory('men')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  avatarCategory === 'men'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Animated (Men)
              </button>
              <button
                type="button"
                onClick={() => setAvatarCategory('women')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  avatarCategory === 'women'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Animated (Women)
              </button>
            </div>

            {/* Gallery Upload Option */}
            {avatarCategory === 'gallery' && (
              <div className="p-3.5 rounded-2xl bg-[#150D27] border border-purple-500/20 flex items-center justify-between gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">Upload from Device Gallery</p>
                    <p className="text-[10px] text-zinc-400">PNG, JPG, WebP or GIF</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-400 hover:text-white border border-white/10"
                      title="Reset to default initials"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs text-white font-medium shadow-md shadow-purple-600/30"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>
            )}

            {/* Animated Avatars for Men */}
            {avatarCategory === 'men' && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {ANIMATED_AVATARS.men.map((av) => {
                  const isSelected = avatarUrl === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setAvatarUrl(av.id)}
                      className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all text-center ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                          : 'bg-[#150D27] border-purple-500/20 hover:border-purple-500/40'
                      }`}
                    >
                      <UserAvatar avatarUrl={av.id} className="w-11 h-11" />
                      <span className="text-[11px] font-semibold text-white leading-none mt-1">
                        {av.name}
                      </span>
                      <span className="text-[9px] text-purple-300/80 bg-purple-500/15 px-1.5 py-0.5 rounded-full">
                        {av.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Animated Avatars for Women */}
            {avatarCategory === 'women' && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {ANIMATED_AVATARS.women.map((av) => {
                  const isSelected = avatarUrl === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setAvatarUrl(av.id)}
                      className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all text-center ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                          : 'bg-[#150D27] border-purple-500/20 hover:border-purple-500/40'
                      }`}
                    >
                      <UserAvatar avatarUrl={av.id} className="w-11 h-11" />
                      <span className="text-[11px] font-semibold text-white leading-none mt-1">
                        {av.name}
                      </span>
                      <span className="text-[9px] text-fuchsia-300/80 bg-fuchsia-500/15 px-1.5 py-0.5 rounded-full">
                        {av.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Email (Read-Only) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Email Address <span className="text-[10px] text-zinc-500 font-normal">(Read-only)</span>
            </label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#150E24] border border-purple-500/15 text-xs text-zinc-400 cursor-not-allowed select-none"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#150E24] border border-purple-500/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>
          </div>

          {/* Unique Username */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-zinc-300">
                Unique Username
              </label>
              {usernameFeedback && (
                <span
                  className={`text-[10px] font-medium ${
                    usernameAvailable
                      ? 'text-emerald-400'
                      : usernameAvailable === false
                      ? 'text-rose-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {usernameFeedback}
                </span>
              )}
            </div>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="choose_a_username"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#150E24] border border-purple-500/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
              {isCheckingUsername && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-400" />
              )}
            </div>
          </div>

          {/* Optional Password Change Accordion */}
          <div className="pt-2 border-t border-purple-500/15">
            <button
              type="button"
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              className="flex items-center justify-between w-full text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                <span>Change Password (Optional)</span>
              </div>
              <span className="text-[10px] text-zinc-400">{showPasswordChange ? 'Hide' : 'Show'}</span>
            </button>

            {showPasswordChange && (
              <div className="space-y-3 mt-3 pt-3 border-t border-purple-500/10 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 rounded-xl bg-[#150E24] border border-purple-500/20 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 rounded-xl bg-[#150E24] border border-purple-500/20 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 rounded-xl bg-[#150E24] border border-purple-500/20 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
