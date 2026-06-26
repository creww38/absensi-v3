'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api-absensi-v2.vercel.app/api';

    // ===== INISIALISASI GLOBAL VARIABLES =====
    if (typeof window !== 'undefined') {
      window.currentUser = null;
      window.siswaData = [];
      window.html5QrCode = null;
      window.authToken = null;
      window.isSidebarCollapsed = false;
      window.localNotif = JSON.parse(localStorage.getItem('local_notif') || '[]');
      window.popupQueue = [];
      window.isPopupShowing = false;
      window.notifSoundUrl = '';
      window.shownBeritaIds = JSON.parse(localStorage.getItem('shown_berita_ids') || '[]');
      window._pendingIzin = [];
      window._lastP = 0;
      window._shownIzin = [];
      window._lastAbsenShown = false;
      window.channelBerita = [];
      window._currentRating = 0;
    }

    // ===== FUNGSI UTAMA =====
    window.setToken = (t) => { window.authToken = t; if (t) localStorage.setItem('auth_token', t); else localStorage.removeItem('auth_token'); };
    window.getToken = () => window.authToken || localStorage.getItem('auth_token') || '';

    window.verifyToken = async () => {
      const t = window.getToken();
      if (!t) return false;
      try {
        const r = await fetch(`${API_BASE}/auth/verify`, { headers: { 'Authorization': 'Bearer ' + t } });
        if (r.ok) {
          const d = await r.json();
          if (d.success && d.user) {
            window.currentUser = { id: d.user.id, username: d.user.role !== 'siswa' ? d.user.id : '', nisn: d.user.role === 'siswa' ? d.user.id : '', nama: d.user.nama, role: d.user.role, kelas: d.user.kelas || '', token: t };
            return true;
          }
        }
      } catch (e) {}
      window.setToken(null);
      return false;
    };

    window.showLoading = () => document.getElementById('loadingOverlay')?.classList.add('active');
    window.hideLoading = () => document.getElementById('loadingOverlay')?.classList.remove('active');

    window.showToast = (title, msg, type = 'info') => {
      const c = document.getElementById('toastContainer');
      if (!c) return;
      const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
      const toast = document.createElement('div');
      toast.style.cssText = `background:${colors[type]};color:white;padding:0.75rem;border-radius:0.5rem;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:flex;align-items:start;gap:0.75rem;min-width:260px;animation:slideInRight 0.3s ease;margin-bottom:0.5rem;z-index:1000;`;
      toast.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':type==='error'?'fa-exclamation-circle':'fa-info-circle'} mt-0.5"></i><div style="flex:1;"><p style="font-weight:bold;">${title}</p><p style="font-size:0.75rem;opacity:0.9;">${msg}</p></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,0.7);">X</button>`;
      c.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
    };

    window.updateLiveClock = () => {
      const n = new Date();
      const el = document.getElementById('liveClock');
      if (el) el.innerHTML = `<i class="far fa-clock mr-1"></i>${n.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
    };

    window.callAPI = async (endpoint, method = 'GET', body = null) => {
      try {
        const t = window.getToken();
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        if (t) opts.headers['Authorization'] = 'Bearer ' + t;
        const r = await fetch(`${API_BASE}${endpoint}`, opts);
        if (r.status === 401) {
          const v = await window.verifyToken();
          if (!v) {
            window.setToken(null); localStorage.removeItem('session'); window.currentUser = null;
            const dc = document.getElementById('dashboardContainer');
            const lp = document.getElementById('loginPage');
            if (dc) dc.style.display = 'none';
            if (lp) lp.style.display = 'flex';
            return { success: false, message: 'Sesi berakhir.', _expired: true };
          }
          const nt = window.getToken();
          if (nt) { opts.headers['Authorization'] = 'Bearer ' + nt; const rr = await fetch(`${API_BASE}${endpoint}`, opts); return await rr.json(); }
        }
        return await r.json();
      } catch (e) { return { success: false, message: 'Gagal terhubung ke server' }; }
    };

    window.loadSiswaFromAPI = async () => {
      try { const r = await window.callAPI('/siswa'); window.siswaData = (r.success && Array.isArray(r.data)) ? r.data : []; }
      catch { window.siswaData = []; }
      return window.siswaData;
    };

    window.toggleSidebarDesktop = () => {
      const s = document.getElementById('sidebar'), m = document.getElementById('mainContent'), b = document.getElementById('toggleSidebarBtn');
      if (!s || !m || !b) return;
      if (window.isSidebarCollapsed) { s.classList.remove('collapsed'); m.classList.remove('expanded'); b.innerHTML = '<i class="fas fa-chevron-left"></i>'; }
      else { s.classList.add('collapsed'); m.classList.add('expanded'); b.innerHTML = '<i class="fas fa-chevron-right"></i>'; }
      window.isSidebarCollapsed = !window.isSidebarCollapsed;
    };

    window.toggleSidebarMobile = () => {
      document.getElementById('sidebar')?.classList.toggle('mobile-open');
      document.getElementById('mobileOverlay')?.classList.toggle('active');
    };

    window.closeSidebarMobile = () => {
      document.getElementById('sidebar')?.classList.remove('mobile-open');
      document.getElementById('mobileOverlay')?.classList.remove('active');
    };

    window.logout = () => {
      if (window.html5QrCode) try { window.html5QrCode.stop(); } catch(e) {}
      window.setToken(null); localStorage.removeItem('session'); localStorage.removeItem('tutorial_done');
      window.currentUser = null;
      const dc = document.getElementById('dashboardContainer');
      const lp = document.getElementById('loginPage');
      if (dc) dc.style.display = 'none';
      if (lp) lp.style.display = 'flex';
      window.closeSidebarMobile();
    };

    window.playNotifSound = () => {
      if (window.notifSoundUrl) { const audio = document.getElementById('notifSound'); if (audio) { audio.src = window.notifSoundUrl; audio.play().catch(() => {}); } }
    };

    window.loadNotifSound = async () => {
      try { const r = await window.callAPI('/config'); if (r.success && r.data?.notification_sound) { window.notifSoundUrl = r.data.notification_sound; } } catch {}
    };

    window.queuePopup = (config) => { window.popupQueue.push(config); if (!window.isPopupShowing) window.processPopupQueue(); };

    window.processPopupQueue = async () => {
      if (window.popupQueue.length === 0) { window.isPopupShowing = false; return; }
      window.isPopupShowing = true;
      const config = window.popupQueue.shift();
      window.playNotifSound();
      await Swal.fire(config);
      setTimeout(() => window.processPopupQueue(), 300);
    };

    window.addNotification = (judul, pesan) => {
      window.localNotif.unshift({ id: Date.now(), judul, pesan, dibaca: false, createdAt: new Date().toISOString() });
      if (window.localNotif.length > 100) window.localNotif = window.localNotif.slice(0, 100);
      localStorage.setItem('local_notif', JSON.stringify(window.localNotif));
      if (window.currentUser?.role === 'siswa') {
        window.queuePopup({ title: judul, text: pesan, icon: 'info', timer: 3000, confirmButtonText: 'OK' });
      } else { window.renderNotifArea(); }
    };

    window.deleteNotif = (id) => {
      window.localNotif = window.localNotif.filter(x => x.id != id);
      localStorage.setItem('local_notif', JSON.stringify(window.localNotif));
      window.renderNotifArea();
      window.showToast('Berhasil', 'Notifikasi dihapus', 'success');
    };

    window.deleteAllNotifications = () => {
      Swal.fire({ title: 'Hapus Semua', text: 'Yakin?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya' }).then(r => {
        if (r.isConfirmed) { window.localNotif = []; localStorage.setItem('local_notif', JSON.stringify(window.localNotif)); window.renderNotifArea(); window.showToast('Berhasil', 'Semua dihapus', 'success'); }
      });
    };

    window.renderNotifArea = () => {
      const area = document.getElementById('notifArea');
      if (!area) return;
      const unread = window.localNotif.filter(n => !n.dibaca).length;
      if (window.currentUser?.role === 'admin') {
        area.innerHTML = `<div class="hamburger-menu"><div class="relative cursor-pointer" onclick="toggleNotifDropdown()"><div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><i class="far fa-bell text-gray-500"></i></div><span class="notification-badge" style="${unread>0?'display:flex;':''}">${unread}</span></div><div id="notifDropdown" class="hamburger-dropdown" style="max-width:360px;"><div style="padding:0.75rem 1rem;background:#4f46e5;color:white;display:flex;justify-content:space-between;align-items:center;border-radius:0.75rem 0.75rem 0 0;"><h3 class="font-semibold text-sm"><i class="fas fa-bell mr-2"></i>Notifikasi</h3><button onclick="deleteAllNotifications()" class="text-xs bg-red-500 hover:bg-red-600 px-2 py-1 rounded">Hapus Semua</button></div><div style="max-height:350px;overflow-y:auto;">${window.localNotif.length===0?'<div class="p-4 text-center text-gray-400 text-sm">Tidak ada</div>':window.localNotif.slice(0,30).map(n=>`<div class="p-3 border-b hover:bg-gray-50 ${!n.dibaca?'bg-blue-50':''}" onclick="markNotifRead('${n.id}')"><p class="text-sm font-semibold">${n.judul}</p><p class="text-xs text-gray-600 mt-1">${n.pesan}</p><div class="flex justify-between items-center mt-1"><span class="text-[10px] text-gray-400">${new Date(n.createdAt).toLocaleString()}</span><button onclick="event.stopPropagation();deleteNotif('${n.id}')" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt text-xs"></i></button></div></div>`).join('')}</div></div></div>`;
      } else {
        area.innerHTML = `<div class="relative cursor-pointer" onclick="showNotifPopUp()"><div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><i class="far fa-bell text-gray-500"></i></div><span class="notification-badge" style="${unread>0?'display:flex;':''}">${unread}</span></div>`;
      }
    };

    window.toggleNotifDropdown = () => { const d = document.getElementById('notifDropdown'); if (d) d.classList.toggle('active'); };

    window.showNotifPopUp = () => {
      const unread = window.localNotif.filter(n => !n.dibaca);
      if (unread.length === 0) { window.queuePopup({ title: 'Notifikasi', text: 'Tidak ada notifikasi baru', icon: 'info' }); return; }
      let html = '<div style="max-height:300px;overflow-y:auto;text-align:left;">';
      unread.slice(0,10).forEach(n => { html += `<div style="padding:0.5rem;border-bottom:1px solid #eee;"><p style="font-weight:bold;font-size:0.85rem;">${n.judul}</p><p style="font-size:0.75rem;color:#666;">${n.pesan}</p><p style="font-size:0.65rem;color:#999;">${new Date(n.createdAt).toLocaleString()}</p></div>`; n.dibaca = true; });
      html += '</div>';
      localStorage.setItem('local_notif', JSON.stringify(window.localNotif));
      window.renderNotifArea();
      window.queuePopup({ title: 'Notifikasi', html: html, confirmButtonText: 'OK' });
    };

    window.markNotifRead = (id) => { const n = window.localNotif.find(x => x.id == id); if (n) n.dibaca = true; localStorage.setItem('local_notif', JSON.stringify(window.localNotif)); window.renderNotifArea(); };
    window.closeNotifDropdown = () => { const d = document.getElementById('notifDropdown'); if (d) d.classList.remove('active'); };

    document.addEventListener('click', (e) => { if (!e.target.closest('.hamburger-menu')) window.closeNotifDropdown(); });

    window.cekBeritaBaru = (beritaList) => {
      if (!beritaList?.length) return;
      beritaList.forEach(b => { const id = b.id || b.judul; if (!window.shownBeritaIds.includes(id)) { window.shownBeritaIds.push(id); window.showToast('Berita Baru!', b.judul, 'info'); } });
      localStorage.setItem('shown_berita_ids', JSON.stringify(window.shownBeritaIds));
    };

    window.cekShareWarning = (beritaList) => {
      if (!beritaList?.length) return;
      const unshared = beritaList.filter(b => !window.shownBeritaIds.includes(b.id || b.judul));
      if (unshared.length > 0) window.showToast('Jangan Lupa!', 'Ada berita baru. Baca dan bagikan ke teman-teman!', 'info');
    };

    window.showPageSkeleton = (type) => {
      const skeletons = {
        dashboard: `<div class="skeleton-row">${[1,2,3,4].map(()=>'<div class="skeleton-card skeleton-page"></div>').join('')}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">${[1,2,3,4].map(()=>'<div class="skeleton-card skeleton-page" style="height:80px;"></div>').join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;"><div class="skeleton-box skeleton-page"></div><div class="skeleton-box skeleton-page"></div></div><div class="skeleton-box skeleton-page" style="height:100px;"></div>`,
        table: `<div class="skeleton-box skeleton-page" style="height:350px;"></div>`,
        form: `<div class="skeleton-box skeleton-page" style="height:300px;"></div>`
      };
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = skeletons[type] || skeletons.table;
    };

    window.buildPieChart = (data, total) => {
      const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
      data.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
      const t = total || counts.Hadir + counts.Sakit + counts.Izin + counts.Alpa || 1;
      const pieEl = document.getElementById('adminPieChart');
      if (!pieEl) return;
      pieEl.innerHTML = '';
      const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
      const statuses = ['Hadir', 'Sakit', 'Izin', 'Alpa'];
      let offset = 0;
      statuses.forEach((status, i) => { const size = (counts[status] / t) * 360; if (size > 0) { window.addPieSlice(pieEl, size, offset, colors[i]); offset += size; } });
    };

    window.addPieSlice = (el, size, offset, color) => {
      const maxSize = 179; let remaining = size, currentOffset = offset;
      while (remaining > 0) {
        const ss = Math.min(remaining, maxSize);
        const slice = document.createElement('div');
        slice.style.cssText = `position:absolute;width:200px;height:200px;clip:rect(0px,200px,200px,100px);transform:rotate(${currentOffset}deg);animation:bake-pie 1s;`;
        const span = document.createElement('span');
        span.style.cssText = `display:block;position:absolute;top:0;left:0;width:200px;height:200px;border-radius:50%;clip:rect(0px,200px,200px,100px);transform:rotate(${-179+ss}deg);background-color:${color};`;
        slice.appendChild(span); el.appendChild(slice);
        remaining -= ss; currentOffset += ss;
      }
    };

    window.getBadge = (s) => {
      const m = { Hadir: 'bg-green-100 text-green-700', Sakit: 'bg-yellow-100 text-yellow-700', Izin: 'bg-blue-100 text-blue-700', Alpa: 'bg-red-100 text-red-700', Belum: 'bg-gray-100 text-gray-600' };
      return m[s] || m.Belum;
    };

    // ===== LOAD HALAMAN =====
    window.showSoundSettings = () => {
      Swal.fire({ title: 'Pengaturan Suara Notifikasi', html: `<input id="soundUrl" class="swal2-input" placeholder="URL file suara (mp3/wav)" value="${window.notifSoundUrl}">`, confirmButtonText: 'Simpan', showCancelButton: true }).then(async r => {
        if (r.isConfirmed) { const url = document.getElementById('soundUrl').value.trim(); window.notifSoundUrl = url; try { await window.callAPI('/config', 'PUT', { notification_sound: url }); window.showToast('Sukses', 'Suara disimpan', 'success'); } catch(e) { window.showToast('Error', 'Gagal menyimpan', 'error'); } }
      });
    };

    window.loadChannelBerita = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Berita Channel';
      window.showPageSkeleton('table');
      window.channelBerita = [];
      try { const r = await window.callAPI('/pengumuman'); if (r.success && r.data) window.channelBerita = r.data; } catch {}
      window.cekBeritaBaru(window.channelBerita);
      window.cekShareWarning(window.channelBerita);
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-4 shadow-sm mb-4"><h3 class="font-semibold"><i class="fas fa-newspaper mr-2 text-indigo-600"></i>Berita</h3></div><div class="space-y-4">${window.channelBerita.length===0?'<div class="bg-white rounded-xl p-8 text-center text-gray-400">Belum ada berita</div>':window.channelBerita.map((b,i)=>`<div class="bg-white rounded-xl p-5 shadow-sm"><h4 class="font-semibold text-lg mb-2">${b.judul}</h4><p class="text-sm text-gray-600 mb-3">${b.isi}</p><div class="flex justify-between items-center flex-wrap gap-2"><span class="text-xs text-gray-400">${b.tanggal?new Date(b.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):''}</span><div class="flex gap-2 flex-wrap"><button onclick="shareBerita('${i}','wa')" class="bg-green-500 text-white px-3 py-1 rounded-lg text-xs"><i class="fab fa-whatsapp mr-1"></i>WA</button><button onclick="shareBerita('${i}','fb')" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs"><i class="fab fa-facebook mr-1"></i>FB</button><button onclick="shareBerita('${i}','twitter')" class="bg-sky-500 text-white px-3 py-1 rounded-lg text-xs"><i class="fab fa-twitter mr-1"></i>Twitter</button><button onclick="shareBerita('${i}','copy')" class="bg-gray-500 text-white px-3 py-1 rounded-lg text-xs"><i class="fas fa-copy mr-1"></i>Copy</button></div></div></div>`).join('')}</div>`;
    };

    window.shareBerita = (idx, platform) => {
      const b = window.channelBerita[idx];
      if (!b) return;
      const text = `${b.judul}\n\n${b.isi}\n\nSumber: MAK Tarbiyatusshibyan`;
      if (platform === 'wa') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      else if (platform === 'fb') window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`, '_blank');
      else if (platform === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
      else if (platform === 'copy') navigator.clipboard.writeText(text).then(() => window.showToast('Sukses', 'Teks berita disalin', 'success'));
    };

    window.showGantiPassword = () => {
      Swal.fire({ title: 'Ganti Password', html: '<input id="oldPass" class="swal2-input" type="password" placeholder="Password Lama"><input id="newPass" class="swal2-input" type="password" placeholder="Password Baru"><input id="newUser" class="swal2-input" placeholder="Username Baru (opsional)">', confirmButtonText: 'Simpan', showCancelButton: true }).then(async r => {
        if (r.isConfirmed) {
          const oldP = document.getElementById('oldPass').value, newP = document.getElementById('newPass').value, newU = document.getElementById('newUser').value;
          if (!oldP) { window.showToast('Error', 'Isi password lama', 'error'); return; }
          const body = { password: oldP }; if (newP) body.newPassword = newP; if (newU) body.newUsername = newU;
          try { const res = await window.callAPI('/guru/' + window.currentUser.username, 'PUT', body); if (res.success) { window.showToast('Sukses', 'Data diubah. Silakan login ulang.', 'success'); setTimeout(window.logout, 2000); } else window.showToast('Error', res.message, 'error'); } catch(e) { window.showToast('Error', 'Gagal', 'error'); }
        }
      });
    };

    window.loadFeedbackPage = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Feedback';
      window.showPageSkeleton('form');
      let myFeedback = []; try { const r = await window.callAPI('/feedback/my'); if (r.success && r.data) myFeedback = r.data; } catch {}
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-4"><div class="lg:col-span-1"><div class="bg-white rounded-xl p-5 shadow-sm"><h3 class="font-semibold text-lg mb-4"><i class="fas fa-comment-dots mr-2 text-purple-600"></i>Kirim Feedback</h3><div class="space-y-3"><div><label class="block text-xs font-medium mb-1">Kategori</label><select id="fbKategori" class="w-full p-2 border rounded-lg text-sm"><option value="umum">Umum</option><option value="saran">Saran</option><option value="bug">Laporan Bug</option><option value="fitur">Permintaan Fitur</option></select></div><div><label class="block text-xs font-medium mb-1">Rating</label><div id="fbRating" class="flex gap-1 text-2xl cursor-pointer">${[1,2,3,4,5].map(i=>`<span onclick="setRating(${i})" class="rating-star text-gray-300 hover:text-yellow-400 transition" data-rating="${i}"><i class="fas fa-star"></i></span>`).join('')}</div><input type="hidden" id="fbRatingValue" value="0"></div><div><label class="block text-xs font-medium mb-1">Pesan</label><textarea id="fbPesan" class="w-full p-2 border rounded-lg text-sm" rows="4" placeholder="Tulis masukan..."></textarea></div><button onclick="submitFeedback()" class="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm"><i class="fas fa-paper-plane mr-1"></i> Kirim</button></div></div></div><div class="lg:col-span-2"><div class="bg-white rounded-xl p-5 shadow-sm"><h3 class="font-semibold text-lg mb-4"><i class="fas fa-history mr-2 text-indigo-600"></i>Riwayat</h3><div class="space-y-3 max-h-96 overflow-y-auto">${myFeedback.length===0?'<div class="text-center py-8"><i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i><p class="text-gray-400">Belum ada</p></div>':myFeedback.map(f=>`<div class="border rounded-lg p-4"><div class="flex justify-between items-start mb-2"><span class="text-xs px-2 py-0.5 rounded-full ${f.kategori==='bug'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}">${f.kategori}</span><span class="text-xs px-2 py-0.5 rounded-full ${f.status==='dibaca'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}">${f.status==='dibaca'?'Dibaca':'Terkirim'}</span></div><p class="text-sm">${f.pesan}</p>${f.rating>0?`<div class="flex gap-1 mt-2 text-yellow-400 text-xs">${'<i class="fas fa-star"></i>'.repeat(f.rating)}</div>`:''}</div>`).join('')}</div></div></div></div>`;
      window._currentRating = 0;
    };

    window.setRating = (r) => { window._currentRating = r; const el = document.getElementById('fbRatingValue'); if (el) el.value = r; document.querySelectorAll('.rating-star').forEach(s => { const rt = parseInt(s.dataset.rating); s.className = rt <= r ? 'rating-star text-yellow-400 transition' : 'rating-star text-gray-300 transition'; }); };

    window.submitFeedback = async () => {
      const kategori = document.getElementById('fbKategori')?.value;
      const pesan = document.getElementById('fbPesan')?.value?.trim();
      const rating = window._currentRating || 0;
      if (!pesan || pesan.length < 5) { window.showToast('Error', 'Pesan minimal 5 karakter', 'error'); return; }
      window.showLoading();
      const res = await window.callAPI('/feedback', 'POST', { kategori, pesan, rating });
      window.hideLoading();
      if (res.success) { window.showToast('Terima Kasih!', 'Feedback telah dikirim.', 'success'); const el = document.getElementById('fbPesan'); if (el) el.value = ''; window.loadFeedbackPage(); }
      else window.showToast('Error', res.message, 'error');
    };

    window.loadAdminDashboard = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Dashboard Admin';
      window.showPageSkeleton('dashboard');
      await window.loadSiswaFromAPI();
      const [izinRes, absenRes, guruRes] = await Promise.all([window.callAPI('/izin/list'), window.callAPI('/absensi/list'), window.callAPI('/guru')]);
      const izinList = izinRes.success ? izinRes.data : [];
      const absensiList = absenRes.success ? absenRes.data : [];
      const guruList = guruRes.success ? guruRes.data : [];
      const today = new Date().toISOString().split('T')[0];
      const todayAbsen = absensiList.filter(a => (a.tanggal || '').startsWith(today));
      const pending = izinList.filter(i => i.status === 'pending');
      const hT = todayAbsen.filter(a => a.status === 'Hadir').length;
      const sT = todayAbsen.filter(a => a.status === 'Sakit').length;
      const iT = todayAbsen.filter(a => a.status === 'Izin').length;
      const aT = todayAbsen.filter(a => a.status === 'Alpa').length;
      const total = window.siswaData.length || 1;
      window._pendingIzin = pending;
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"><div class="stat-card bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500"><p class="text-gray-400 text-xs">Total Siswa</p><p class="text-2xl font-bold">${window.siswaData.length}</p></div><div class="stat-card bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500 stat-clickable" onclick="showPendingIzinPopup()"><p class="text-gray-400 text-xs">Izin Menunggu</p><p class="text-2xl font-bold text-yellow-600">${pending.length}</p></div><div class="stat-card bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500"><p class="text-gray-400 text-xs">Absen Hari Ini</p><p class="text-2xl font-bold text-green-600">${hT}</p></div><div class="stat-card bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500"><p class="text-gray-400 text-xs">Total Guru</p><p class="text-2xl font-bold text-blue-600">${guruList.length}</p></div></div><div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">${[{icon:'fa-users',label:'Data Siswa',color:'indigo',fn:'loadDataSiswa()'},{icon:'fa-clipboard-list',label:'Kelola Absen',color:'green',fn:'loadKelolaAbsensi()'},{icon:'fa-file-excel',label:'Rekap Absen',color:'blue',fn:'loadRekapAbsensi()'},{icon:'fa-qrcode',label:'Scan QR',color:'purple',fn:'loadScanAbsensi()'}].map(x=>`<button onclick="${x.fn}" class="bg-${x.color}-50 p-4 rounded-xl text-center hover:bg-${x.color}-100 stat-card"><i class="fas ${x.icon} text-2xl mb-2 block text-${x.color}-600"></i><span class="text-xs">${x.label}</span></button>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;"><div class="bg-white rounded-xl p-5 shadow-sm"><h3 class="font-semibold text-sm mb-4">Statistik Kehadiran</h3><div class="pie-chart-pie" id="adminPieChart"></div><ul class="pie-legend"><li><span class="legend-dot" style="background:#10b981;"></span> Hadir <span class="legend-value">${hT} (${((hT/total)*100).toFixed(1)}%)</span></li><li><span class="legend-dot" style="background:#f59e0b;"></span> Sakit <span class="legend-value">${sT} (${((sT/total)*100).toFixed(1)}%)</span></li><li><span class="legend-dot" style="background:#3b82f6;"></span> Izin <span class="legend-value">${iT} (${((iT/total)*100).toFixed(1)}%)</span></li><li><span class="legend-dot" style="background:#ef4444;"></span> Alpa <span class="legend-value">${aT} (${((aT/total)*100).toFixed(1)}%)</span></li></ul></div><div class="bg-white rounded-xl p-5 shadow-sm"><h3 class="font-semibold text-sm mb-4">Progress Hari Ini</h3><div class="space-y-3">${[{l:'Hadir',v:hT,p:(hT/total)*100,c:'bg-green-500'},{l:'Sakit',v:sT,p:(sT/total)*100,c:'bg-yellow-500'},{l:'Izin',v:iT,p:(iT/total)*100,c:'bg-blue-500'},{l:'Alpa',v:aT,p:(aT/total)*100,c:'bg-red-500'}].map(x=>`<div><div class="flex justify-between text-xs mb-1"><span>${x.l}</span><span class="font-semibold">${x.v} (${x.p.toFixed(1)}%)</span></div><div class="progress-bar"><div class="progress-fill ${x.c}" style="width:${x.p}%"></div></div></div>`).join('')}</div></div></div>`;
      setTimeout(() => window.buildPieChart(absensiList, total), 300);
    };

    window.showPendingIzinPopup = () => {
      const list = window._pendingIzin || [];
      if (list.length === 0) { Swal.fire({ title: 'Izin Menunggu', text: 'Tidak ada pengajuan.', icon: 'info' }); return; }
      let html = '<div style="max-height:350px;overflow-y:auto;text-align:left;">';
      list.forEach(i => { html += `<div style="padding:0.75rem;border:1px solid #e5e7eb;border-radius:0.5rem;margin-bottom:0.75rem;"><p style="font-weight:bold;">${i.pengaju||i.nisn}</p><p style="font-size:0.8rem;"><span style="background:#fef3c7;padding:2px 8px;border-radius:4px;">${(i.jenis||'').toUpperCase()}</span> | ${i.tanggalMulai} ${i.tanggalAkhir!==i.tanggalMulai?'- '+i.tanggalAkhir:''}</p><p style="font-size:0.8rem;color:#666;">Alasan: ${i.keterangan||'Tidak ada'}</p><div style="margin-top:0.75rem;display:flex;gap:0.5rem;"><button onclick="prosesIzinFromPopup('${i.id}','approve')" style="flex:1;padding:0.6rem;background:#10B981;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-weight:bold;">SETUJUI</button><button onclick="prosesIzinFromPopup('${i.id}','reject')" style="flex:1;padding:0.6rem;background:#EF4444;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-weight:bold;">TOLAK</button></div></div>`; });
      html += '</div>';
      Swal.fire({ title: 'Persetujuan (' + list.length + ')', html: html, showConfirmButton: false, width: '550px' });
    };

    window.prosesIzinFromPopup = async (id, aksi) => {
      Swal.close();
      const res = await window.callAPI(`/izin/${id}/${aksi}`, 'PUT');
      if (res.success) { window.addNotification('Izin ' + (aksi === 'approve' ? 'Disetujui' : 'Ditolak'), 'Pengajuan #' + id + ' telah diproses.'); window.showToast('Berhasil', aksi === 'approve' ? 'Izin disetujui' : 'Izin ditolak', 'success'); window.loadAdminDashboard(); }
      else window.showToast('Error', res.message, 'error');
    };

    window.loadDataSiswa = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Data Siswa';
      window.showPageSkeleton('table');
      await window.loadSiswaFromAPI();
      if (!window.siswaData.length) { const area = document.getElementById('mainContentArea'); if (area) area.innerHTML = `<div class="bg-white rounded-xl p-8 text-center"><p class="text-gray-500">Belum ada data</p><button onclick="loadDataSiswa()" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Refresh</button></div>`; return; }
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-4 shadow-sm mb-4 flex flex-wrap gap-3"><input type="text" id="searchSiswa" placeholder="Cari NISN atau Nama..." class="flex-1 px-3 py-2 border rounded-lg text-sm"><span class="text-sm bg-gray-100 px-3 py-2 rounded-lg">${window.siswaData.length} siswa</span></div><div class="bg-white rounded-xl shadow-sm overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="p-3 text-left">NISN</th><th class="p-3 text-left">Nama</th><th class="p-3 text-left">Kelas</th></tr></thead><tbody id="siswaTable">${window.siswaData.map(s=>`<tr class="border-t hover:bg-gray-50"><td class="p-3 font-mono">${s.nisn}</td><td class="p-3 font-medium">${s.nama}</td><td class="p-3">${s.kelas||'-'}</td></tr>`).join('')}</tbody></table></div>`;
      setTimeout(() => { document.getElementById('searchSiswa')?.addEventListener('keyup', e => { const v = e.target.value.toLowerCase(); document.querySelectorAll('#siswaTable tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none'); }); }, 100);
    };

    window.loadSiswaDashboard = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Dashboard Siswa';
      window.showPageSkeleton('dashboard');
      await window.loadSiswaFromAPI();
      const un = document.getElementById('navUserName'); if (un) un.innerHTML = window.currentUser.nama;
      const [absenRes, pengRes, izinRes, liburRes, channelRes] = await Promise.all([window.callAPI('/absensi/list'), window.callAPI('/pengumuman/active'), window.callAPI('/izin/list'), window.callAPI('/libur'), window.callAPI('/channel')]);
      const absensiList = (absenRes.success && absenRes.data) ? absenRes.data.filter(a => a.nisn === window.currentUser.nisn) : [];
      const pengumumanList = (pengRes.success && pengRes.data) ? pengRes.data : [];
      const izinList = (izinRes.success && izinRes.data) ? izinRes.data.filter(i => i.nisn === window.currentUser.nisn) : [];
      const liburList = (liburRes.success && liburRes.data) ? liburRes.data : [];
      const channelList = (channelRes.success && channelRes.data) ? channelRes.data : [];
      const today = new Date().toISOString().split('T')[0];
      const absenToday = absensiList.find(a => (a.tanggal || '').startsWith(today));
      const totalH = absensiList.filter(a => a.status === 'Hadir').length;
      const totalS = absensiList.filter(a => a.status === 'Sakit').length;
      const totalI = absensiList.filter(a => a.status === 'Izin').length;
      const totalA = absensiList.filter(a => a.status === 'Alpa').length;
      const totalAll = totalH + totalS + totalI + totalA || 1;
      const maxVal = Math.max(totalH, totalS, totalI, totalA, 1);
      const now = new Date();
      const myData = window.siswaData.find(s => s.nisn === window.currentUser.nisn) || {};
      const todayLibur = liburList.find(l => l.tanggal === today);
      if (todayLibur) { setTimeout(() => { window.queuePopup({ title: 'Sekolah Sedang Libur!', html: `<div style="text-align:left;"><p><b>Tanggal:</b> ${todayLibur.tanggal}</p><p><b>Keterangan:</b> ${todayLibur.keterangan||'Hari libur'}</p><p style="color:#10B981;margin-top:8px;">Anda tidak perlu absen hari ini.</p></div>`, icon: 'info', confirmButtonText: 'OK' }); }, 500); }
      window.cekBeritaBaru(channelList);
      window.cekShareWarning(channelList);
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div style="margin-bottom:16px;border-radius:16px;overflow:hidden;position:relative;height:160px;background:linear-gradient(135deg,#1a1967,#4f46e5);"><img src="https://www.image2url.com/r2/default/gifs/1782184371933-fc0a347c-c857-48c3-8127-cf0790d7f7b0.gif" alt="Banner" style="width:100%;height:100%;object-fit:cover;opacity:0.6;"><div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(26,25,103,0.9),rgba(26,25,103,0.4));"></div><div style="position:absolute;bottom:16px;left:16px;color:white;"><p style="font-size:18px;font-weight:700;">${window.currentUser.nama}</p><p style="font-size:12px;opacity:0.8;">${window.currentUser.kelas||'-'} | NISN: ${window.currentUser.nisn}</p><span style="display:inline-block;background:#facc15;color:#1e1b4b;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-top:6px;">${absenToday?absenToday.status:'Belum Absen'}</span></div></div><div class="grid grid-cols-2 gap-3 mb-4"><div class="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl p-4 text-white"><p class="opacity-80 text-xs">Hari Ini</p><p class="text-lg font-bold">${now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p><p class="text-2xl font-mono mt-1">${now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</p></div><div class="bg-white rounded-xl p-4 shadow-sm"><p class="text-xs text-gray-400 mb-2">Status Absensi</p><p class="text-xl font-bold ${absenToday?.status==='Hadir'?'text-green-600':'text-red-500'}">${absenToday?.status||'Belum'}</p>${absenToday?.jamDatang?`<p class="text-xs text-gray-500 mt-1">Masuk: ${absenToday.jamDatang}</p>`:''}${absenToday?.jamPulang?`<p class="text-xs text-gray-500">Pulang: ${absenToday.jamPulang}</p>`:''}</div></div><div class="bg-white rounded-xl p-4 shadow-sm mb-4"><h3 class="font-semibold text-sm mb-3">Riwayat Kehadiran (Total: ${totalAll})</h3><div class="space-y-2">${[{l:'Hadir',v:totalH,c:'bg-green-500'},{l:'Sakit',v:totalS,c:'bg-yellow-500'},{l:'Izin',v:totalI,c:'bg-blue-500'},{l:'Alpa',v:totalA,c:'bg-red-500'}].map(x=>`<div><div class="flex justify-between text-xs mb-1"><span>${x.l}</span><span>${x.v}</span></div><div class="progress-bar"><div class="progress-fill ${x.c}" style="width:${(x.v/maxVal)*100}%"></div></div></div>`).join('')}</div></div><div class="bg-white rounded-xl p-4 shadow-sm mb-4"><h3 class="font-semibold text-sm mb-3">Data Diri</h3><div class="grid grid-cols-2 gap-2 text-xs">${[['Nama',myData.nama||window.currentUser.nama],['NISN',myData.nisn||window.currentUser.nisn],['Kelas',myData.kelas||'-'],['Jenis Kelamin',myData.jenisKelamin||'-'],['Tgl Lahir',myData.tanggalLahir||'-'],['Agama',myData.agama||'-'],['Ayah',myData.namaAyah||'-'],['Ibu',myData.namaIbu||'-'],['No HP',myData.noHp||'-'],['Alamat',myData.alamat||'-']].map(x=>`<div><span class="text-gray-400">${x[0]}</span><p class="font-semibold">${x[1]}</p></div>`).join('')}</div></div><div class="bg-white rounded-xl p-4 shadow-sm"><h3 class="font-semibold text-sm mb-3"><i class="fas fa-bullhorn mr-2 text-indigo-600"></i>Pengumuman</h3><div class="space-y-2 max-h-40 overflow-y-auto">${pengumumanList.length===0?'<p class="text-gray-400 text-center py-4 text-xs">Belum ada</p>':pengumumanList.map(p=>`<div class="bg-blue-50 rounded-lg p-3"><p class="font-semibold text-xs">${p.judul}</p><p class="text-xs text-gray-600 mt-1">${p.isi}</p></div>`).join('')}</div></div>`;
      setTimeout(() => window.showTutorialSiswa(), 1500);
    };

    window.showTutorialSiswa = () => {
      if (localStorage.getItem('tutorial_done') === '1') return;
      const steps = [
        { icon: 'fa-qrcode', color: '#6366f1', title: 'Kartu Digital', desc: 'Klik untuk melihat Kartu Digital kamu.', action: () => { Swal.close(); window.loadQRCodeSiswa?.(); } },
        { icon: 'fa-clipboard-list', color: '#f59e0b', title: 'Ajukan Izin', desc: 'Klik untuk buka Riwayat Izin & Sakit.', action: () => { Swal.close(); window.loadIzinSiswaPage?.(); } },
        { icon: 'fa-newspaper', color: '#3b82f6', title: 'Berita Channel', desc: 'Klik untuk membaca berita.', action: () => { Swal.close(); window.loadChannelBerita?.(); } },
        { icon: 'fa-bell', color: '#ef4444', title: 'Notifikasi', desc: 'Klik ikon lonceng di pojok kanan atas.', action: () => { Swal.close(); window.showToast('Info', 'Klik ikon lonceng!', 'info'); } }
      ];
      let step = 0;
      const btnTexts = ['Lihat Kartu Digital', 'Buka Izin & Sakit', 'Buka Berita Channel', 'Mengerti'];
      const showStep = () => {
        if (step >= steps.length) { Swal.close(); localStorage.setItem('tutorial_done', '1'); window.showToast('Tutorial Selesai!', 'Kamu sudah siap.', 'success'); return; }
        const s = steps[step];
        Swal.fire({ title: `<i class="fas ${s.icon}" style="color:${s.color};font-size:56px;display:block;margin-bottom:16px;"></i>${s.title}`, html: `<p style="font-size:15px;color:#475569;">${s.desc}</p>`, confirmButtonText: btnTexts[step], confirmButtonColor: s.color, showCancelButton: true, cancelButtonText: 'Lewati Semua', cancelButtonColor: '#94a3b8' }).then(r => { if (r.isConfirmed) { s.action?.(); step++; setTimeout(showStep, 600); } else Swal.close(); });
      };
      setTimeout(showStep, 1500);
    };

    window.loadIzinSiswaPage = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Riwayat Izin & Sakit';
      window.showPageSkeleton('table');
      let izinList = []; try { const r = await window.callAPI('/izin/list'); if (r.success && r.data) izinList = r.data.filter(i => i.nisn == window.currentUser.nisn); } catch {}
      const sc = { pending: 'bg-yellow-100 text-yellow-700', disetujui: 'bg-green-100 text-green-700', ditolak: 'bg-red-100 text-red-700' }, st = { pending: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-4 shadow-sm mb-4 flex justify-between items-center"><h3 class="font-semibold">Riwayat Pengajuan</h3><button onclick="showAjukanIzin()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus mr-1"></i> Ajukan</button></div><div class="bg-white rounded-xl shadow-sm overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="p-3">Tanggal</th><th class="p-3">Jenis</th><th class="p-3">Keterangan</th><th class="p-3 text-center">Status</th></tr></thead><tbody>${izinList.length===0?'<tr><td colspan="4" class="p-4 text-center text-gray-400">Belum ada pengajuan</td>':izinList.map(i=>`<tr class="border-t"><td class="p-3">${i.tanggalMulai}${i.tanggalAkhir!==i.tanggalMulai?' - '+i.tanggalAkhir:''}</td><td class="p-3">${i.jenis==='izin'?'Izin':'Sakit'}</td><td class="p-3">${i.keterangan||'-'}</td><td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-xs ${sc[i.status]}">${st[i.status]}</span></td></tr>`).join('')}</tbody></table></div>`;
    };

    window.showAjukanIzin = () => {
      Swal.fire({ title: 'Ajukan Izin / Sakit', html: `<select id="jenisIzin" class="swal2-select mb-3"><option value="izin">Izin</option><option value="sakit">Sakit</option></select><input type="date" id="tglMulai" class="swal2-input"><input type="date" id="tglAkhir" class="swal2-input" placeholder="Tanggal Akhir (opsional)"><textarea id="alasanIzin" class="swal2-textarea" placeholder="Alasan"></textarea>`, confirmButtonText: 'Ajukan', showCancelButton: true, preConfirm: () => ({ jenis: document.getElementById('jenisIzin').value, tanggalMulai: document.getElementById('tglMulai').value, tanggalAkhir: document.getElementById('tglAkhir').value, keterangan: document.getElementById('alasanIzin').value }) }).then(async r => {
        if (r.isConfirmed && r.value?.tanggalMulai && r.value?.keterangan) {
          const tglAkhir = r.value.tanggalAkhir || r.value.tanggalMulai;
          const res = await window.callAPI('/izin/create', 'POST', { jenis: r.value.jenis, keterangan: r.value.keterangan, tanggalMulai: r.value.tanggalMulai, tanggalAkhir: tglAkhir });
          if (res.success) { window.showToast('Berhasil', 'Pengajuan berhasil', 'success'); window.loadIzinSiswaPage(); }
          else window.showToast('Error', res.message, 'error');
        } else window.showToast('Error', 'Tanggal dan alasan harus diisi', 'error');
      });
    };

    window.loadGuruDashboard = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Dashboard Guru';
      window.showPageSkeleton('dashboard');
      await window.loadSiswaFromAPI();
      let absensiList = []; try { const r = await window.callAPI('/absensi/list'); if (r.success && r.data) absensiList = r.data; } catch {}
      const today = new Date().toISOString().split('T')[0];
      const hadir = absensiList.filter(a => (a.tanggal || '').startsWith(today) && a.status === 'Hadir').length;
      const sakit = absensiList.filter(a => (a.tanggal || '').startsWith(today) && a.status === 'Sakit').length;
      const izin = absensiList.filter(a => (a.tanggal || '').startsWith(today) && a.status === 'Izin').length;
      const alpa = absensiList.filter(a => (a.tanggal || '').startsWith(today) && a.status === 'Alpa').length;
      const belum = window.siswaData.length - hadir - sakit - izin - alpa;
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">${[{l:'Siswa',v:window.siswaData.length,c:'indigo'},{l:'Hadir',v:hadir,c:'green'},{l:'Sakit',v:sakit,c:'yellow'},{l:'Izin',v:izin,c:'blue'},{l:'Belum',v:belum<0?0:belum,c:'gray'}].map(x=>`<div class="stat-card bg-white p-4 rounded-xl shadow-sm text-center"><p class="text-gray-400 text-xs">${x.l}</p><p class="text-xl font-bold text-${x.c}-600">${x.v}</p></div>`).join('')}</div><div class="grid grid-cols-2 gap-4"><button onclick="loadMonitoring()" class="bg-indigo-600 text-white py-4 rounded-xl font-semibold">Monitoring</button><button onclick="loadScanAbsensi()" class="bg-emerald-600 text-white py-4 rounded-xl font-semibold">Scan QR</button></div>`;
    };

    window.loadScanAbsensi = () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Scan QR Absensi';
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-5 shadow-sm max-w-2xl mx-auto"><div class="mb-4 flex gap-3"><button onclick="setScanMode('masuk')" id="btnModeMasuk" class="flex-1 py-2 rounded-lg text-white font-semibold bg-indigo-600">Absen Masuk</button><button onclick="setScanMode('pulang')" id="btnModePulang" class="flex-1 py-2 rounded-lg font-semibold bg-gray-200 text-gray-600">Absen Pulang</button></div><div id="qr-reader" style="min-height:300px;"></div><p id="scanStatus" class="text-center text-sm text-gray-500 mt-3">Siap scan QR Code</p><button onclick="manualInputNISN()" class="mt-3 w-full bg-gray-100 py-2 rounded-lg">Input Manual (NISN/Nama)</button></div>`;
      window.currentScanMode = 'masuk';
      window.startScanner?.();
    };

    window.setScanMode = (mode) => {
      window.currentScanMode = mode;
      const btnM = document.getElementById('btnModeMasuk');
      const btnP = document.getElementById('btnModePulang');
      if (btnM) btnM.className = mode === 'masuk' ? 'flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold' : 'flex-1 py-2 rounded-lg bg-gray-200 text-gray-600 font-semibold';
      if (btnP) btnP.className = mode === 'pulang' ? 'flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold' : 'flex-1 py-2 rounded-lg bg-gray-200 text-gray-600 font-semibold';
    };

    window.startScanner = () => {
      if (window.html5QrCode) window.html5QrCode.stop().catch(() => {});
      try { window.html5QrCode = new Html5Qrcode("qr-reader"); window.html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 300 }, (decoded) => { window.html5QrCode.stop(); window.processScan(decoded); setTimeout(window.startScanner, 1500); }, () => {}); } catch(e) {}
    };

    window.processScan = async (nisn) => {
      window.showLoading();
      const r = await window.callAPI('/absensi/scan', 'POST', { nisn, scannerRole: window.currentUser.role });
      window.hideLoading();
      if (r.success) {
        window.showToast('Berhasil', `${r.nama} - ${r.message}`, 'success');
        window.addNotification('Absen Berhasil', `${r.nama} - ${r.message}`);
        await window.loadSiswaFromAPI();
        if (window.currentUser.role === 'siswa') { window._lastAbsenShown = false; window.loadSiswaDashboard(); }
        else if (window.currentUser.role === 'admin') window.loadAdminDashboard();
        else if (window.currentUser.role === 'guru') window.loadGuruDashboard();
      } else window.showToast('Error', r.message, 'error');
    };

    window.manualInputNISN = () => {
      Swal.fire({ title: 'Input NISN atau Nama', input: 'text', inputPlaceholder: 'Masukkan NISN atau Nama Lengkap', showCancelButton: true, confirmButtonText: 'Proses', inputValidator: (value) => { if (!value || value.trim() === '') return 'NISN atau Nama harus diisi!'; } }).then((res) => { if (res.isConfirmed) window.processScan(res.value.trim()); });
    };

    window.loadQRCodeSiswa = () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Kartu Digital';
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="flex justify-center items-center min-h-[80vh]"><div class="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md w-full"><div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center"><div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><i class="fas fa-user-graduate text-4xl"></i></div><h3 class="font-bold text-xl">${window.currentUser.nama}</h3><p class="text-sm opacity-90">NISN: ${window.currentUser.nisn}</p><p class="text-sm opacity-75">Kelas: ${window.currentUser.kelas||'-'}</p></div><div class="p-8 text-center"><div id="qrcode" class="flex justify-center mb-4"></div><p class="text-sm text-gray-500 mb-4">Scan kode ini untuk melakukan absensi</p><button onclick="downloadQR()" class="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm w-full hover:bg-indigo-700 transition"><i class="fas fa-download mr-2"></i> Simpan Kartu</button></div></div></div>`;
      setTimeout(() => { new QRCode(document.getElementById("qrcode"), { text: window.currentUser.nisn, width: 200, height: 200, colorDark: "#1a1967" }); }, 300);
    };

    window.downloadQR = () => {
      const img = document.querySelector('#qrcode img');
      if (img) { const a = document.createElement('a'); a.download = 'qrcode.png'; a.href = img.src; a.click(); }
    };

    // Fungsi tambahan untuk admin (loadKelolaAbsensi, loadRekapAbsensi, loadMonitoring, loadDataGuru, loadIzinList, loadKelolaLibur, showPengumumanModal)
    window.loadKelolaAbsensi = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Kelola Absensi';
      window.showPageSkeleton('table');
      await window.loadSiswaFromAPI();
      let absensiList = []; try { const r = await window.callAPI('/absensi/list'); if (r.success && r.data) absensiList = r.data; } catch {}
      const today = new Date().toISOString().split('T')[0];
      const todayAbsen = absensiList.filter(a => (a.tanggal || '').startsWith(today));
      const hL = todayAbsen.filter(a => a.status === 'Hadir'), sL = todayAbsen.filter(a => a.status === 'Sakit'), iL = todayAbsen.filter(a => a.status === 'Izin'), aL = todayAbsen.filter(a => a.status === 'Alpa'), bL = window.siswaData.filter(s => !todayAbsen.find(a => a.nisn == s.nisn));
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-4 shadow-sm mb-4"><div class="flex justify-between items-center flex-wrap gap-3 mb-4"><h3 class="font-semibold"><i class="fas fa-calendar-day mr-2 text-indigo-600"></i>Absensi: ${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h3><button onclick="exportTodayAbsen()" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-download mr-1"></i>Export</button></div><div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">${[{l:'HADIR',v:hL.length,c:'green'},{l:'SAKIT',v:sL.length,c:'yellow'},{l:'IZIN',v:iL.length,c:'blue'},{l:'ALPA',v:aL.length,c:'red'},{l:'BELUM',v:bL.length,c:'gray'}].map(x=>`<div class="bg-${x.c}-50 rounded-lg p-3 text-center cursor-pointer stat-card" onclick="scrollToSection('${x.l.toLowerCase()}Section')"><p class="text-xs text-${x.c}-600 font-semibold">${x.l}</p><p class="text-xl font-bold text-${x.c}-700">${x.v}</p></div>`).join('')}</div></div><div class="space-y-4">${[{id:'hadir',icon:'fa-check-circle',color:'green',list:hL,label:'Siswa Hadir'},{id:'sakit',icon:'fa-notes-medical',color:'yellow',list:sL,label:'Siswa Sakit'},{id:'izin',icon:'fa-clipboard-list',color:'blue',list:iL,label:'Siswa Izin'},{id:'alpa',icon:'fa-exclamation-triangle',color:'red',list:aL,label:'Siswa Alpa'}].map(x=>`<div id="${x.id}Section" class="bg-white rounded-xl shadow-sm overflow-hidden"><div class="p-3 bg-${x.color}-50 border-b"><h4 class="font-semibold text-sm text-${x.color}-700"><i class="fas ${x.icon} mr-2"></i>${x.label} (${x.list.length})</h4></div><div class="overflow-x-auto"><table class="w-full text-sm"><tbody>${x.list.length===0?`<tr><td class="p-4 text-center text-gray-400">Belum ada</td></tr>`:x.list.map(a=>{const s=window.siswaData.find(y=>y.nisn==a.nisn);return`<tr class="border-t"><td class="p-2 pl-4">${s?.nisn||a.nisn}</td><td class="p-2 font-medium">${s?.nama||a.nama}</td><td class="p-2">${s?.kelas||'-'}</td>${x.id==='hadir'?`<td class="p-2 text-right pr-4 text-xs text-gray-500">${a.jamDatang||'-'} - ${a.jamPulang||'-'}</td>`:''}</tr>`;}).join('')}</tbody></table></div></div>`).join('')}<div id="belumSection" class="bg-white rounded-xl shadow-sm overflow-hidden"><div class="p-3 bg-gray-50 border-b"><h4 class="font-semibold text-sm text-gray-700"><i class="fas fa-clock mr-2"></i>Belum Absen (${bL.length})</h4></div><div class="overflow-x-auto"><table class="w-full text-sm"><tbody>${bL.length===0?'<tr><td class="p-4 text-center text-gray-400">Semua sudah absen</td></tr>':bL.map(s=>`<tr class="border-t"><td class="p-2 pl-4">${s.nisn}</td><td class="p-2 font-medium">${s.nama}</td><td class="p-2">${s.kelas||'-'}</td><td class="p-2 text-right pr-4"><button onclick="updateAbsenManual('${s.nisn}','${s.nama}')" class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">Update</button></td></tr>`).join('')}</tbody></table></div></div></div>`;
    };

    window.scrollToSection = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

    window.updateAbsenManual = (nisn, nama) => {
      Swal.fire({ title: `Update: ${nama}`, html: `<select id="ns" class="swal2-select"><option>Hadir</option><option>Sakit</option><option>Izin</option><option>Alpa</option></select>`, confirmButtonText: 'Simpan' }).then(async r => {
        if (r.isConfirmed) { const s = document.getElementById('ns').value; const res = await window.callAPI('/monitoring/status', 'PUT', { nisn, nama, kelas: '', status: s }); if (res.success) { window.showToast('Sukses', 'Status diupdate', 'success'); window.loadKelolaAbsensi(); } else window.showToast('Error', res.message, 'error'); }
      });
    };

    window.exportTodayAbsen = () => {
      const today = new Date().toISOString().split('T')[0];
      const data = window.siswaData.map(s => ({ NISN: s.nisn, Nama: s.nama, Kelas: s.kelas || '-' }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, today);
      XLSX.writeFile(wb, `absensi_${today}.xlsx`);
      window.showToast('Sukses', 'File diunduh', 'success');
    };

    window.loadRekapAbsensi = () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Rekap Absensi';
      const t = new Date().toISOString().split('T')[0];
      const s = new Date(); s.setDate(1);
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-5 shadow-sm max-w-2xl mx-auto"><h3 class="font-semibold text-lg mb-4"><i class="fas fa-chart-line mr-2 text-indigo-600"></i>Rekap Absensi</h3><div class="space-y-4"><div><label class="block text-sm font-medium mb-1">Tanggal Mulai</label><input type="date" id="startDate" class="w-full p-2 border rounded-lg" value="${s.toISOString().split('T')[0]}"></div><div><label class="block text-sm font-medium mb-1">Tanggal Akhir</label><input type="date" id="endDate" class="w-full p-2 border rounded-lg" value="${t}"></div><div><label class="block text-sm font-medium mb-1">Kelas (Opsional)</label><select id="filterKelas" class="w-full p-2 border rounded-lg"><option value="">Semua Kelas</option>${[...new Set(window.siswaData.map(s=>s.kelas).filter(Boolean))].map(k=>`<option value="${k}">${k}</option>`).join('')}</select></div><button onclick="generateRekap()" class="w-full bg-green-600 text-white py-2 rounded-lg font-semibold"><i class="fas fa-file-excel mr-2"></i>Export Excel</button></div></div>`;
    };

    window.generateRekap = async () => {
      const sd = document.getElementById('startDate')?.value, ed = document.getElementById('endDate')?.value;
      if (!sd || !ed) { window.showToast('Error', 'Pilih tanggal', 'error'); return; }
      const res = await window.callAPI(`/absensi/list?tanggalMulai=${sd}&tanggalAkhir=${ed}`);
      if (res.success && res.data) { const ws = XLSX.utils.json_to_sheet(res.data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rekap'); XLSX.writeFile(wb, `rekap_${sd}_${ed}.xlsx`); window.showToast('Sukses', 'File diunduh', 'success'); }
      else window.showToast('Error', 'Gagal', 'error');
    };

    window.loadMonitoring = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Monitoring Kehadiran';
      window.showPageSkeleton('table');
      await window.loadSiswaFromAPI();
      let absensiList = []; try { const r = await window.callAPI('/absensi/list'); if (r.success && r.data) absensiList = r.data; } catch {}
      const today = new Date().toISOString().split('T')[0];
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-4 shadow-sm mb-4"><input type="text" id="searchMonitoring" placeholder="Cari..." class="w-full px-4 py-2 border rounded-lg text-sm"></div><div class="bg-white rounded-xl shadow-sm overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="p-3">NISN</th><th class="p-3">Nama</th><th class="p-3">Kelas</th><th class="p-3 text-center">Status</th><th class="p-3 text-center">Masuk</th><th class="p-3 text-center">Pulang</th></tr></thead><tbody id="monitoringTable">${window.siswaData.map(s=>{const a=absensiList.find(x=>x.nisn==s.nisn&&(x.tanggal||'').startsWith(today));return`<tr class="border-t"><td class="p-3">${s.nisn}</td><td class="p-3 font-medium">${s.nama}</td><td class="p-3">${s.kelas||'-'}</td><td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-xs ${window.getBadge(a?.status)}">${a?.status||'Belum'}</span></td><td class="p-3 text-center">${a?.jamDatang||'-'}</td><td class="p-3 text-center">${a?.jamPulang||'-'}</td></tr>`}).join('')}</tbody></table></div>`;
      setTimeout(() => { document.getElementById('searchMonitoring')?.addEventListener('keyup', e => { const v = e.target.value.toLowerCase(); document.querySelectorAll('#monitoringTable tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none'); }); }, 100);
    };

    window.loadDataGuru = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Data Guru';
      window.showPageSkeleton('table');
      let guruList = []; try { const r = await window.callAPI('/guru'); if (r.success && r.data) guruList = r.data; } catch {}
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-4 shadow-sm mb-4 flex gap-3 flex-wrap"><button onclick="showTambahGuru()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus mr-1"></i> Tambah Guru</button><input type="text" id="searchGuru" placeholder="Cari..." class="flex-1 px-3 py-2 border rounded-lg text-sm"></div><div class="bg-white rounded-xl shadow-sm overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="p-3">Username</th><th class="p-3">Nama</th><th class="p-3">Kelas</th><th class="p-3 text-center">Aksi</th></tr></thead><tbody id="guruTable">${guruList.map(g=>`<tr class="border-t"><td class="p-3">${g.username}</td><td class="p-3 font-medium">${g.nama||g.username}</td><td class="p-3">${g.kelas||'-'}</td><td class="p-3 text-center"><button onclick="hapusGuru('${g.username}')" class="text-red-600"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table></div>`;
      setTimeout(() => { document.getElementById('searchGuru')?.addEventListener('keyup', e => { const v = e.target.value.toLowerCase(); document.querySelectorAll('#guruTable tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none'); }); }, 100);
    };

    window.showTambahGuru = () => {
      Swal.fire({ title: 'Tambah Guru', html: '<input id="gu" class="swal2-input" placeholder="Username"><input id="gp" class="swal2-input" type="password" placeholder="Password"><input id="gn" class="swal2-input" placeholder="Nama"><input id="gk" class="swal2-input" placeholder="Kelas">', confirmButtonText: 'Simpan' }).then(async r => {
        if (r.isConfirmed) { const res = await window.callAPI('/guru', 'POST', { username: document.getElementById('gu').value, password: document.getElementById('gp').value, nama: document.getElementById('gn').value, kelas: document.getElementById('gk').value }); if (res.success) { window.showToast('Sukses', 'Guru ditambahkan', 'success'); window.loadDataGuru(); } else window.showToast('Error', res.message, 'error'); }
      });
    };

    window.hapusGuru = async (u) => {
      const r = await Swal.fire({ title: 'Yakin hapus?', text: `Guru "${u}" akan dihapus`, icon: 'warning', showCancelButton: true });
      if (r.isConfirmed) { const res = await window.callAPI(`/guru/${u}`, 'DELETE'); if (res.success) { window.showToast('Sukses', 'Guru dihapus', 'success'); window.loadDataGuru(); } else window.showToast('Error', res.message, 'error'); }
    };

    window.loadIzinList = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Kelola Izin';
      window.showPageSkeleton('table');
      let izinList = []; try { const r = await window.callAPI('/izin/list'); if (r.success && r.data) izinList = r.data; } catch {}
      const sc = { pending: 'bg-yellow-100 text-yellow-700', disetujui: 'bg-green-100 text-green-700', ditolak: 'bg-red-100 text-red-700' }, st = { pending: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl shadow-sm overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="p-3">Tanggal</th><th class="p-3">NISN</th><th class="p-3">Nama</th><th class="p-3">Keterangan</th><th class="p-3 text-center">Status</th><th class="p-3 text-center">Aksi</th></tr></thead><tbody>${izinList.length===0?'<tr><td colspan="6" class="p-4 text-center text-gray-400">Belum ada</td>':izinList.map(i=>`<tr class="border-t"><td class="p-3">${i.tanggalMulai}</td><td class="p-3">${i.nisn}</td><td class="p-3 font-medium">${i.pengaju||'-'}</td><td class="p-3">${i.keterangan||'-'}</td><td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-xs ${sc[i.status]}">${st[i.status]}</span></td><td class="p-3 text-center">${i.status==='pending'?`<button onclick="prosesIzin('${i.id}','approve')" class="text-green-600 mr-2"><i class="fas fa-check"></i></button><button onclick="prosesIzin('${i.id}','reject')" class="text-red-600"><i class="fas fa-times"></i></button>`:'-'}</td></tr>`).join('')}</tbody></table></div>`;
    };

    window.prosesIzin = async (id, aksi) => {
      const res = await window.callAPI(`/izin/${id}/${aksi}`, 'PUT');
      if (res.success) { window.showToast('Sukses', aksi === 'approve' ? 'Disetujui' : 'Ditolak', 'success'); window.loadIzinList(); }
      else window.showToast('Error', res.message, 'error');
    };

    window.loadKelolaLibur = async () => {
      const pt = document.getElementById('pageTitle'); if (pt) pt.innerHTML = 'Hari Libur';
      window.showPageSkeleton('table');
      let liburList = []; try { const r = await window.callAPI('/libur'); if (r.success && r.data) liburList = r.data; } catch {}
      const area = document.getElementById('mainContentArea');
      if (area) area.innerHTML = `<div class="bg-white rounded-xl p-4 shadow-sm mb-4"><button onclick="showTambahLibur()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus mr-1"></i> Tambah Libur</button></div><div class="bg-white rounded-xl shadow-sm overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="p-3">Tanggal</th><th class="p-3">Keterangan</th><th class="p-3 text-center">Aksi</th></tr></thead><tbody>${liburList.map(l=>`<tr class="border-t"><td class="p-3">${l.tanggal}</td><td class="p-3">${l.keterangan}</td><td class="p-3 text-center"><button onclick="hapusLibur('${l.tanggal}')" class="text-red-600"><i class="fas fa-trash"></i></button></td></tr>`).join('')}${liburList.length===0?'<tr><td colspan="3" class="p-4 text-center text-gray-400">Belum ada</td></tr>':''}</tbody></table></div>`;
    };

    window.showTambahLibur = () => {
      Swal.fire({ title: 'Tambah Hari Libur', html: '<input type="date" id="lt" class="swal2-input"><input id="lk" class="swal2-input" placeholder="Keterangan">', confirmButtonText: 'Simpan' }).then(async r => {
        if (r.isConfirmed) { const res = await window.callAPI('/libur', 'POST', { tanggal: document.getElementById('lt').value, keterangan: document.getElementById('lk').value }); if (res.success) { window.showToast('Sukses', 'Libur ditambahkan', 'success'); window.loadKelolaLibur(); } else window.showToast('Error', res.message, 'error'); }
      });
    };

    window.hapusLibur = async (t) => {
      const r = await Swal.fire({ title: 'Hapus libur?', text: `Hari libur tanggal ${t} akan dihapus`, icon: 'warning', showCancelButton: true });
      if (r.isConfirmed) { const res = await window.callAPI(`/libur/${t}`, 'DELETE'); if (res.success) { window.showToast('Sukses', 'Libur dihapus', 'success'); window.loadKelolaLibur(); } else window.showToast('Error', res.message, 'error'); }
    };

    window.showPengumumanModal = () => {
      Swal.fire({ title: 'Buat Pengumuman', html: `<input id="pj" class="swal2-input" placeholder="Judul Pengumuman" style="margin-bottom:8px;"><textarea id="pi" class="swal2-textarea" placeholder="Isi pengumuman..." rows="3"></textarea>`, confirmButtonText: 'Kirim', showCancelButton: true, cancelButtonText: 'Batal', preConfirm: () => { const judul = document.getElementById('pj').value.trim(); const isi = document.getElementById('pi').value.trim(); if (!judul) { Swal.showValidationMessage('Judul harus diisi'); return false; } if (!isi) { Swal.showValidationMessage('Isi harus diisi'); return false; } return { judul, isi }; } }).then(async (result) => {
        if (result.isConfirmed && result.value) { window.showLoading(); try { const res = await window.callAPI('/pengumuman', 'POST', { judul: result.value.judul, isi: result.value.isi }); window.hideLoading(); if (res.success) { window.showToast('Sukses', 'Pengumuman berhasil dikirim!', 'success'); window.addNotification('Pengumuman Baru', result.value.judul); } else { window.showToast('Error', res.message || 'Gagal mengirim pengumuman', 'error'); } } catch(e) { window.hideLoading(); window.showToast('Error', 'Gagal terhubung ke server', 'error'); } }
      });
    };

    // ===== INIT DASHBOARD =====
    window.initDashboard = async () => {
      const un = document.getElementById('navUserName');
      const ur = document.getElementById('navUserRole');
      if (un) un.innerHTML = window.currentUser.nama;
      if (ur) ur.innerHTML = window.currentUser.role.toUpperCase();
      window.updateLiveClock();
      window.renderNotifArea();

      const myData = window.siswaData.find(s => s.nisn === window.currentUser.nisn);
      const fotoUrl = myData?.foto || myData?.[10] || '';
      const userPhoto = document.getElementById('navUserPhoto');
      const userInitial = document.getElementById('navUserInitial');
      if (userPhoto && userInitial) {
        if (fotoUrl && fotoUrl !== '' && fotoUrl !== null && fotoUrl !== undefined) {
          userPhoto.src = fotoUrl; userPhoto.style.display = 'block'; userInitial.style.display = 'none';
        } else {
          userPhoto.style.display = 'none'; userInitial.style.display = 'flex';
          userInitial.innerHTML = window.currentUser.nama.charAt(0).toUpperCase();
        }
      }

      const menu = document.getElementById('sidebarMenu');
      if (!menu) return;
      let html = '';
      if (window.currentUser.role === 'admin') {
        html = `<button onclick="loadAdminDashboard()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-home w-5"></i><span class="sidebar-label">Dashboard</span></button><button onclick="loadDataSiswa()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-users w-5"></i><span class="sidebar-label">Data Siswa</span></button><button onclick="loadDataGuru()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-chalkboard-user w-5"></i><span class="sidebar-label">Data Guru</span></button><button onclick="loadKelolaAbsensi()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-clipboard-list w-5"></i><span class="sidebar-label">Kelola Absen</span></button><button onclick="loadRekapAbsensi()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-file-excel w-5"></i><span class="sidebar-label">Rekap Absen</span></button><button onclick="loadKelolaLibur()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-calendar-alt w-5"></i><span class="sidebar-label">Hari Libur</span></button><button onclick="loadIzinList()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-clipboard-list w-5"></i><span class="sidebar-label">Kelola Izin</span></button><button onclick="loadChannelBerita()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-newspaper w-5"></i><span class="sidebar-label">Berita Channel</span></button><button onclick="showPengumumanModal()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-bullhorn w-5"></i><span class="sidebar-label">Pengumuman</span></button><button onclick="showGantiPassword()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-key w-5"></i><span class="sidebar-label">Ganti Password</span></button><button onclick="showSoundSettings()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-volume-up w-5"></i><span class="sidebar-label">Suara Notifikasi</span></button><button onclick="loadScanAbsensi()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-qrcode w-5"></i><span class="sidebar-label">Scan QR</span></button>`;
        window.loadAdminDashboard();
      } else if (window.currentUser.role === 'guru') {
        html = `<button onclick="loadGuruDashboard()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-home w-5"></i><span class="sidebar-label">Dashboard</span></button><button onclick="loadMonitoring()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-eye w-5"></i><span class="sidebar-label">Monitoring</span></button><button onclick="loadChannelBerita()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-newspaper w-5"></i><span class="sidebar-label">Berita Channel</span></button><button onclick="loadScanAbsensi()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-qrcode w-5"></i><span class="sidebar-label">Scan QR</span></button>`;
        window.loadGuruDashboard();
      } else {
        html = `<button onclick="loadSiswaDashboard()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-home w-5"></i><span class="sidebar-label">Dashboard</span></button><button onclick="loadIzinSiswaPage()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-clipboard-list w-5"></i><span class="sidebar-label">Riwayat Izin & Sakit</span></button><button onclick="loadChannelBerita()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-newspaper w-5"></i><span class="sidebar-label">Berita Channel</span></button><button onclick="loadFeedbackPage()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-comment-dots w-5"></i><span class="sidebar-label">Feedback</span></button><button onclick="loadQRCodeSiswa()" class="nav-item w-full flex items-center gap-3 p-3 rounded-xl text-gray-300 hover:text-white"><i class="fas fa-id-card w-5"></i><span class="sidebar-label">Kartu Digital</span></button>`;
        window.loadSiswaDashboard();
      }
      menu.innerHTML = html;
      const logoutBtn = document.getElementById('logoutButton');
      if (logoutBtn) logoutBtn.onclick = (e) => { e.preventDefault(); window.logout(); };
    };

    // ===== EVENT LISTENERS =====
    const btnSiswa = document.getElementById('btnSiswaTab');
    const btnAdmin = document.getElementById('btnAdminTab');
    if (btnSiswa) btnSiswa.onclick = () => {
      btnSiswa.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white text-indigo-600 shadow-sm';
      if (btnAdmin) btnAdmin.className = 'flex-1 py-1.5 text-xs font-medium rounded-lg text-gray-500';
      const fSiswa = document.getElementById('formSiswaLogin');
      const fAdmin = document.getElementById('formAdminLogin');
      const err = document.getElementById('loginError');
      if (fSiswa) fSiswa.style.display = 'block';
      if (fAdmin) fAdmin.style.display = 'none';
      if (err) err.style.display = 'none';
    };
    if (btnAdmin) btnAdmin.onclick = () => {
      btnAdmin.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white text-indigo-600 shadow-sm';
      if (btnSiswa) btnSiswa.className = 'flex-1 py-1.5 text-xs font-medium rounded-lg text-gray-500';
      const fSiswa = document.getElementById('formSiswaLogin');
      const fAdmin = document.getElementById('formAdminLogin');
      const err = document.getElementById('loginError');
      if (fSiswa) fSiswa.style.display = 'none';
      if (fAdmin) fAdmin.style.display = 'block';
      if (err) err.style.display = 'none';
    };

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      window.showLoading();
      const isA = document.getElementById('formAdminLogin')?.style.display !== 'none';
      let result;
      if (isA) {
        const u = document.getElementById('username')?.value?.trim();
        const p = document.getElementById('password')?.value?.trim();
        if (!u || !p) { window.hideLoading(); window.showToast('Error', 'Isi username dan password', 'error'); return; }
        result = await window.callAPI('/auth/login', 'POST', { username: u, password: p });
      } else {
        const n = document.getElementById('nisn')?.value?.trim();
        if (!n) { window.hideLoading(); window.showToast('Error', 'Isi NISN atau Nama', 'error'); return; }
        result = await window.callAPI('/auth/login', 'POST', { nisn: n });
      }
      window.hideLoading();
      if (result?.success) {
        window.setToken(result.token);
        window.currentUser = { id: result.nisn || result.username, username: result.username || '', nisn: result.nisn || '', nama: result.nama || 'User', role: result.role || 'siswa', kelas: result.kelas || '', token: result.token };
        localStorage.setItem('session', JSON.stringify(window.currentUser));
        await window.loadSiswaFromAPI();
        await window.loadNotifSound();
        const lp = document.getElementById('loginPage');
        const dc = document.getElementById('dashboardContainer');
        if (lp) lp.style.display = 'none';
        if (dc) dc.style.display = 'block';
        window.initDashboard();
        window.showToast('Selamat Datang', window.currentUser.nama, 'success');
      } else {
        const err = document.getElementById('loginError');
        const errText = document.getElementById('errorText');
        if (err) err.style.display = 'block';
        if (errText) errText.innerText = result?.message || 'Login gagal.';
        setTimeout(() => { if (err) err.style.display = 'none'; }, 3000);
      }
    });

    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', window.toggleSidebarDesktop);

    // ===== SPLASH SCREEN =====
    let w = 0;
    const iv = setInterval(() => { w += 10; if (w >= 100) clearInterval(iv); const p = document.getElementById('splashProgress'); if (p) p.style.width = w + '%'; }, 80);
    setTimeout(() => { const s = document.getElementById('splashScreen'); if (s) { s.style.opacity = '0'; setTimeout(() => { if (s) s.style.display = 'none'; }, 500); } }, 1500);

    const updateDate = () => { const d = document.getElementById('currentDateDisplay'); if (d) d.innerHTML = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
    updateDate(); setInterval(updateDate, 60000);
    window.updateLiveClock(); setInterval(window.updateLiveClock, 1000);

    // ===== AUTO LOGIN =====
    (async () => {
      const saved = localStorage.getItem('session');
      if (!saved) return;
      try {
        const u = JSON.parse(saved);
        if (u.token) window.setToken(u.token);
        const v = await window.verifyToken();
        if (v) {
          const lp = document.getElementById('loginPage');
          const dc = document.getElementById('dashboardContainer');
          if (lp) lp.style.display = 'none';
          if (dc) dc.style.display = 'block';
          await window.loadSiswaFromAPI();
          await window.loadNotifSound();
          window.initDashboard();
        } else {
          localStorage.removeItem('session'); window.setToken(null);
          const lp = document.getElementById('loginPage');
          const dc = document.getElementById('dashboardContainer');
          if (lp) lp.style.display = 'flex';
          if (dc) dc.style.display = 'none';
        }
      } catch { localStorage.removeItem('session'); window.setToken(null); }
    })();
  }, []);

  return (
    <>
      <div id="splashScreen" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e1b4b, #0f172a)', transition: 'opacity 0.5s' }}>
        <img src="https://files.catbox.moe/3od6ig.png" alt="Logo" style={{ width: 100, height: 100, marginBottom: '1rem', objectFit: 'contain' }} />
        <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>SISTEM ABSENSI</h1>
        <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: '0.5rem 0 1.5rem' }}>Presensi & Informasi Tarbiyatusshibyan</p>
        <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' }}><div id="splashProgress" style={{ width: '0%', height: '100%', background: 'white', transition: 'width 0.05s' }}></div></div>
        <p style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '1rem' }}>Memuat aplikasi...</p>
      </div>
      <div id="loadingOverlay"><div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}><div className="spinner"></div><p>Memproses...</p></div></div>
      <div id="toastContainer" style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}></div>
      <audio id="notifSound" preload="auto" style={{ display: 'none' }}></audio>

      <div id="loginPage" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'linear-gradient(135deg, #0f172a, #1e1b4b, #0f172a)' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '20rem', height: '20rem', background: '#4f46e6', borderRadius: '9999px', filter: 'blur(128px)', opacity: 0.4 }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '20rem', height: '20rem', background: '#9333ea', borderRadius: '9999px', filter: 'blur(128px)', opacity: 0.4 }}></div>
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '56rem', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)', borderRadius: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', padding: '1.5rem', color: 'white', minHeight: 260, backgroundImage: "url('https://files.catbox.moe/jl72ny.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(49,46,129,0.9), rgba(49,46,129,0.6))' }}></div>
            <div style={{ position: 'relative', zIndex: 10 }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><div style={{ width: '2rem', height: '2rem', background: 'rgba(255,255,255,0.2)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-school"></i></div><span style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>MA PLUS TARBIYATUSSHIBYAN</span></div><h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Presensi & Informasi</h1><p style={{ color: '#c7d2fe', fontSize: '0.75rem', marginTop: '0.5rem' }}>Platform manajemen kehadiran siswa yang terintegrasi.</p></div>
          </div>
          <div style={{ background: 'white', padding: '1.5rem' }}><div style={{ maxWidth: '24rem', margin: '0 auto' }}><div className="text-center mb-4"><h2 className="text-lg font-bold">Selamat Datang</h2><p className="text-gray-500 text-xs">Silakan masuk ke akun Anda</p></div>
            <div className="bg-gray-50 p-1 rounded-xl flex mb-4"><button id="btnSiswaTab" className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white text-indigo-600 shadow-sm"><i className="fas fa-user-graduate"></i> Siswa</button><button id="btnAdminTab" className="flex-1 py-1.5 text-xs font-medium rounded-lg text-gray-500"><i className="fas fa-chalkboard-teacher"></i> Guru/Admin</button></div>
            <form id="loginForm"><div id="formSiswaLogin"><input type="text" id="nisn" className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-sm mb-3" placeholder="NISN atau Nama Lengkap" /></div><div id="formAdminLogin" style={{ display: 'none' }}><input type="text" id="username" className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-sm mb-2" placeholder="Username" /><input type="password" id="password" className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-sm" placeholder="Password" /></div><button type="submit" className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-xl font-semibold text-sm">MASUK</button></form>
            <div id="loginError" className="mt-3 hidden p-2 bg-rose-50 rounded-lg text-center"><p id="errorText" className="text-rose-600 text-xs"></p></div><p className="text-center text-[10px] text-gray-400 mt-3">MAK TARBIYATUSSHIBYAN KOTA BOGOR</p></div></div>
        </div>
      </div>

      <div id="dashboardContainer" style={{ display: 'none' }}>
        <aside id="sidebar" className="sidebar">
          <div className="flex items-center justify-between p-4 border-b border-indigo-900/50"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center"><i className="fas fa-qrcode text-white"></i></div><span className="font-bold text-white sidebar-label">PINTAR</span></div><button id="toggleSidebarBtn" className="text-white/70"><i className="fas fa-chevron-left"></i></button></div>
          <div className="p-4"><div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
            <img id="navUserPhoto" className="w-10 h-10 rounded-xl object-cover" style={{ display: 'none' }} alt="User" />
            <div id="navUserInitial" className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white">U</div>
            <div className="sidebar-label"><p id="navUserName" className="font-semibold text-sm text-white">User</p><span id="navUserRole" className="text-[10px] font-bold uppercase bg-indigo-800 px-2 py-0.5 rounded-full text-indigo-200">Role</span></div>
          </div></div>
          <nav id="sidebarMenu" className="flex-1 px-3 space-y-1 pb-4"></nav>
          <div className="p-4 border-t border-indigo-900/50 mt-auto"><button id="logoutButton" className="flex items-center gap-3 text-red-300 hover:text-white hover:bg-red-500/20 w-full p-3 rounded-xl transition"><i className="fas fa-sign-out-alt"></i><span className="sidebar-label">Keluar</span></button></div>
        </aside>
        <div id="mobileOverlay" className="mobile-overlay" onClick={() => window.closeSidebarMobile?.()}></div>
        <main id="mainContent" className="main-content">
          <header><div className="flex items-center gap-3"><button id="mobileMenuBtn" className="p-2 rounded-lg hover:bg-gray-100 md:hidden" onClick={() => window.toggleSidebarMobile?.()}><i className="fas fa-bars text-gray-600"></i></button><h2 id="pageTitle" className="text-lg font-bold text-gray-800">Dashboard</h2></div><div className="flex items-center gap-4"><div id="liveClock" className="text-xs font-mono bg-gray-100 px-3 py-1 rounded-lg text-gray-700"></div><p id="currentDateDisplay" className="text-xs text-gray-500"></p><div id="notifArea"></div></div></header>
          <div id="mainContentArea"></div>
        </main>
      </div>
    </>
  );
}