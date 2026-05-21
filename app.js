window.crm = function crm() {
  return {
    customers: [],
    search: '',
    filter: 'all',
    modalOpen: false,
    bulkOpen: false,
    bulkText: '',
    editing: {},
    quick: { name: '', company: '', phone: '', status: 'lead' },
    clock: '',

    prospect: {
      open: false,
      loading: false,
      searched: false,
      error: '',
      trade: '43.22',
      location: '',
      limit: 50,
      results: [],
      totalScanned: 0,
      checking: 0,
      checked: 0,
      toCheck: 0,
      funnel: null,
      onlyActive: false,
      onlyMva: false,
      hideEnk: false,
      dedupe: true,
      debug: false,
      trades: [
        { code: '43.221', label: 'Rørlegger (VVS)' },
        { code: '43.210', label: 'Elektriker' },
        { code: '43.320', label: 'Snekker / innredning' },
        { code: '43.340', label: 'Maler / glassarbeid' },
        { code: '43.310', label: 'Murer / pussing' },
        { code: '43.910', label: 'Taktekker' },
        { code: '43.990', label: 'Annet bygg / spesialisert' },
        { code: '41.000', label: 'Bygg av bolig / yrkesbygg' },
        { code: '81.300', label: 'Hage / anleggsgartner' },
        { code: '96.210', label: 'Frisør' },
        { code: '96.220', label: 'Skjønnhetspleie' },
        { code: '96.230', label: 'Hud, massasje, spa' },
        { code: '95.310', label: 'Bilverksted' },
        { code: '95.220', label: 'Reparasjon hvitevarer' },
        { code: '49.410', label: 'Transport / lastebil' },
        { code: '49.320', label: 'Drosje' },
        { code: '56.110', label: 'Restaurant' },
        { code: '56.300', label: 'Bar / pub' },
        { code: '56.210', label: 'Catering' },
        { code: '74.200', label: 'Fotograf' },
        { code: '93.130', label: 'Treningssenter' },
      ],
    },

    statusOptions: [
      { value: 'lead',     label: 'Skal ringe' },
      { value: 'called',   label: 'Ringt' },
      { value: 'followup', label: 'Oppfølging' },
      { value: 'won',      label: 'Solgt' },
      { value: 'lost',     label: 'Tapt' },
    ],
    filters: [
      { value: 'all',      label: 'Alle' },
      { value: 'lead',     label: 'Skal ringe' },
      { value: 'called',   label: 'Ringt' },
      { value: 'followup', label: 'Oppfølging' },
      { value: 'won',      label: 'Solgt' },
      { value: 'lost',     label: 'Tapt' },
    ],

    async init() {
      await this.loadFromCloud();
      this.subscribeRealtime();
      this.tick();
      setInterval(() => this.tick(), 1000);
    },

    async loadFromCloud() {
      try {
        const { data, error } = await window.sb.from('customers').select('data');
        if (error) throw error;
        this.customers = (data || []).map(r => r.data);
      } catch (e) {
        console.error('Kunne ikke laste fra Supabase:', e);
      }
    },

    subscribeRealtime() {
      window.sb.channel('customers-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, payload => {
          if (payload.eventType === 'DELETE') {
            this.customers = this.customers.filter(c => c.id !== payload.old.id);
          } else {
            const row = payload.new.data;
            const i = this.customers.findIndex(c => c.id === row.id);
            if (i >= 0) this.customers[i] = row; else this.customers.push(row);
          }
        })
        .subscribe();
    },

    async saveCustomer(c) {
      try {
        const { error } = await window.sb.from('customers').upsert({ id: c.id, data: c, updated_at: new Date().toISOString() });
        if (error) throw error;
      } catch (e) { console.error('Lagring feilet:', e); }
    },

    async deleteCustomer(id) {
      try {
        const { error } = await window.sb.from('customers').delete().eq('id', id);
        if (error) throw error;
      } catch (e) { console.error('Sletting feilet:', e); }
    },

    tick() {
      const d = new Date();
      this.clock = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    },

    async persist() {
      try {
        if (!this.customers.length) return;
        const rows = this.customers.map(c => ({ id: c.id, data: c, updated_at: new Date().toISOString() }));
        const { error } = await window.sb.from('customers').upsert(rows);
        if (error) throw error;
      } catch (e) { console.error('Lagring feilet:', e); }
    },
    uid() { return Math.random().toString(36).slice(2, 11); },

    get stats() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).getTime();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yStart = todayStart - 86400000;

      const sumWon = (from, to) => this.customers
        .filter(c => c.status === 'won' && c.updated >= from && c.updated < to)
        .reduce((s,c) => s + (Number(c.value) || 0), 0);

      const month = sumWon(monthStart, Date.now() + 1);
      const lastMonth = sumWon(lastMonthStart, monthStart);
      const today = sumWon(todayStart, Date.now() + 1);
      const yesterday = sumWon(yStart, todayStart);

      return {
        month: Math.round(month / 1000),
        monthDelta: Math.round((month - lastMonth) / 1000),
        today: Math.round(today / 1000),
        yesterday: Math.round(yesterday / 1000),
      };
    },

    get topDeals() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return this.customers
        .filter(c => c.status === 'won' && c.updated >= monthStart && Number(c.value) > 0)
        .map(c => ({ name: c.name, value: Number(c.value) }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 8);
    },

    get newThisWeek() {
      const weekAgo = Date.now() - 86400000 * 7;
      return this.customers.filter(c => c.created >= weekAgo).length;
    },

    get winRate() {
      const closed = this.customers.filter(c => c.status === 'won' || c.status === 'lost').length;
      if (closed === 0) return 0;
      const won = this.customers.filter(c => c.status === 'won').length;
      return Math.round(won / closed * 100);
    },

    countBy(s) {
      if (s === 'all') return this.customers.length;
      return this.customers.filter(c => c.status === s).length;
    },

    get filteredCustomers() {
      const q = this.search.toLowerCase().trim();
      return this.customers
        .filter(c => this.filter === 'all' || c.status === this.filter)
        .filter(c => !q || (c.name + ' ' + (c.company||'') + ' ' + (c.phone||'') + ' ' + (c.email||'')).toLowerCase().includes(q))
        .sort((a,b) => b.updated - a.updated);
    },

    statusLabel(s) { return (this.statusOptions.find(o => o.value === s) || {}).label || s; },

    fmt(n) {
      if (n === null || n === undefined || isNaN(n)) return '0';
      return Number(n).toLocaleString('no-NO');
    },

    formatDate(ts) {
      if (!ts) return '—';
      const d = new Date(ts), now = new Date();
      const diff = (now - d) / 86400000;
      if (diff < 1) return 'I dag';
      if (diff < 2) return 'I går';
      if (diff < 7) return Math.floor(diff) + ' dager siden';
      return d.toLocaleDateString('no-NO', { day: '2-digit', month: 'short' });
    },

    quickAdd() {
      if (!this.quick.name.trim()) return;
      const now = Date.now();
      this.customers.push({
        id: this.uid(),
        name: this.quick.name.trim(),
        company: this.quick.company.trim(),
        phone: this.quick.phone.trim(),
        email: '',
        status: this.quick.status,
        value: 0,
        notes: '',
        created: now,
        updated: now,
      });
      this.persist();
      this.quick = { name: '', company: '', phone: '', status: this.quick.status };
      document.querySelector('.quick-add input')?.focus();
    },

    bulkImport() {
      const lines = this.bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      const now = Date.now();
      let added = 0;
      lines.forEach(line => {
        const parts = line.split(/[,\t]/).map(p => p.trim());
        if (!parts[0]) return;
        this.customers.push({
          id: this.uid(),
          name: parts[0],
          company: parts[1] || '',
          phone: parts[2] || '',
          email: parts[3] || '',
          status: 'lead',
          value: 0,
          notes: '',
          created: now,
          updated: now,
        });
        added++;
      });
      this.persist();
      this.bulkText = '';
      this.bulkOpen = false;
      if (added > 0) alert(added + ' kunder lagt til!');
    },

    domainCandidates(navn) {
      let s = (navn || '').toLowerCase()
        .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
        .replace(/&/g, ' og ')
        .replace(/[.,'"`/\\()!?]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const legal = new Set(['as','asa','ans','da','nuf','sa','enk','bedrift']);
      const connector = new Set(['og','the','of','for','co','i','på','pa']);
      const trade = new Set(['frisor','bygg','transport','eiendom','holding','invest','consulting','design','gruppen','group','salong','klinikk','studio','service','tjenester','as','bil','elektro','elektriker','rorlegger','vvs','maler','snekker','taktekker','anlegg','catering','restaurant','bar','pub','kafe','cafe','fotograf','trening','hud','spa','massasje','negl','barber']);
      const allWords = s.split(' ').filter(w => w && !legal.has(w));
      if (allWords.length === 0) return [];
      const noConn = allWords.filter(w => !connector.has(w));
      const brand = noConn.filter(w => !trade.has(w));
      const brandWithConn = allWords.filter(w => !trade.has(w));

      const bases = new Set();
      const add = (parts) => {
        if (!parts || parts.length === 0) return;
        bases.add(parts.join(''));
        if (parts.length > 1) bases.add(parts.join('-'));
      };
      add(allWords);
      add(noConn);
      add(brand);
      add(brandWithConn);
      add(brand.slice(0, 2));
      add(brandWithConn.slice(0, 3));
      add(noConn.slice(0, 2));

      const tlds = ['.no', '.com', '.net'];
      const variants = new Set();
      for (const base of bases) {
        if (!base) continue;
        if (!/^[a-z0-9-]+$/.test(base)) continue;
        if (base.length < 4) continue;
        const isSingleShortWord = brand.length === 1 && base === brand[0] && base.length < 6;
        if (isSingleShortWord) continue;
        for (const tld of tlds) {
          variants.add(base + tld);
        }
      }
      return Array.from(variants).slice(0, 12);
    },

    async verifyHttp(domain) {
      const tryUrl = async (url) => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          await fetch(url, { method: 'GET', mode: 'no-cors', signal: ctrl.signal, redirect: 'follow' });
          clearTimeout(t);
          return true;
        } catch (e) { return false; }
      };
      if (await tryUrl('https://' + domain + '/')) return true;
      if (await tryUrl('https://www.' + domain + '/')) return true;
      return false;
    },

    websiteFromEmail(epost) {
      if (!epost) return null;
      const m = String(epost).toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
      if (!m) return null;
      const domain = m[1];
      const generic = new Set(['gmail.com','hotmail.com','hotmail.no','outlook.com','yahoo.com','yahoo.no','live.no','live.com','icloud.com','online.no','broadpark.no','getmail.no','msn.com','me.com']);
      if (generic.has(domain)) return null;
      return domain;
    },

    async dohHas(domain) {
      try {
        const r = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=A', {
          headers: { 'Accept': 'application/dns-json' },
        });
        if (!r.ok) return false;
        const j = await r.json();
        return !!(j.Answer && j.Answer.some(a => a.type === 1));
      } catch (e) { return false; }
    },

    async checkHasWebsite(r) {
      const tried = [];
      const emailDomain = this.websiteFromEmail(r.epost);
      if (emailDomain) {
        tried.push({ domain: emailDomain, source: 'email', hit: true });
        return { has: true, domain: emailDomain, source: 'email', tried };
      }
      const cands = this.domainCandidates(r.navn);
      for (const d of cands) {
        const dnsHit = await this.dohHas(d);
        if (!dnsHit) {
          tried.push({ domain: d, source: 'dns', hit: false });
          continue;
        }
        const httpHit = await this.verifyHttp(d);
        tried.push({ domain: d, source: 'dns+http', hit: httpHit });
        if (httpHit) return { has: true, domain: d, source: 'dns+http', tried };
      }
      return { has: false, tried };
    },

    async runProspect() {
      this.prospect.loading = true;
      this.prospect.error = '';
      this.prospect.results = [];
      this.prospect.totalScanned = 0;
      this.prospect.checking = 0;
      this.prospect.checked = 0;
      this.prospect.toCheck = 0;
      this.prospect.funnel = null;
      this.prospect.searched = true;
      try {
        const params = new URLSearchParams();
        params.set('naeringskode', this.prospect.trade);
        params.set('size', '100');
        const loc = (this.prospect.location || '').trim();
        if (loc) {
          if (/^\d{4}$/.test(loc)) {
            params.set('forretningsadresse.postnummer', loc);
          } else {
            params.set('forretningsadresse.kommune', loc.toUpperCase());
          }
        }
        const url = 'https://data.brreg.no/enhetsregisteret/api/enheter?' + params.toString();
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('Brreg svarte ' + res.status);
        const data = await res.json();
        const list = (data._embedded && data._embedded.enheter) || [];
        this.prospect.totalScanned = list.length;
        const funnel = { brreg: list.length };

        const existing = new Set(this.customers.map(c => (c.orgnr || '').toString()));
        let mapped = list
          .filter(e => !e.slettedato && !e.konkurs && !e.underAvvikling && !e.underTvangsavviklingEllerTvangsopplosning);
        funnel.afterStatus = mapped.length;
        mapped = mapped.map(e => {
            const a = e.forretningsadresse || {};
            const adresse = [
              (a.adresse || []).join(' '),
              a.postnummer,
              a.poststed,
            ].filter(Boolean).join(', ');
            const orgform = (e.organisasjonsform && e.organisasjonsform.kode) || '';
            const ansatte = Number(e.antallAnsatte) || 0;
            const mva = !!e.registrertIMVAregisteret;
            const stiftet = e.stiftelsesdato || '';
            const alder = stiftet ? Math.max(0, new Date().getFullYear() - Number(stiftet.slice(0,4))) : null;

            let score = 0;
            if (ansatte >= 1) score += 3;
            if (ansatte >= 3) score += 2;
            if (mva) score += 2;
            if (orgform === 'AS') score += 1;
            if (alder !== null && alder >= 2) score += 1;
            if (e.telefon || e.mobil) score += 1;
            if (e.epostadresse) score += 1;

            return {
              orgnr: e.organisasjonsnummer,
              navn: e.navn,
              telefon: e.telefon || e.mobil || '',
              epost: e.epostadresse || '',
              adresse,
              orgform,
              ansatte,
              mva,
              alder,
              score,
              added: existing.has(e.organisasjonsnummer),
            };
          });

        if (this.prospect.onlyActive) {
          mapped = mapped.filter(r =>
            r.ansatte >= 1 ||
            r.mva ||
            r.telefon ||
            r.epost ||
            r.orgform === 'AS' ||
            r.orgform === 'ASA'
          );
        }
        funnel.afterActive = mapped.length;
        if (this.prospect.onlyMva) {
          mapped = mapped.filter(r => r.mva);
        }
        funnel.afterMva = mapped.length;
        if (this.prospect.hideEnk) {
          mapped = mapped.filter(r => r.orgform !== 'ENK');
        }
        funnel.afterEnk = mapped.length;

        if (this.prospect.dedupe) {
          const seen = new Map();
          for (const r of mapped) {
            const keys = [];
            if (r.telefon) keys.push('t:' + r.telefon.replace(/\s+/g, ''));
            if (r.epost) keys.push('e:' + r.epost.toLowerCase());
            const stem = (r.navn || '').toUpperCase().split(/[ ,]/)[0];
            if (stem && r.adresse) keys.push('na:' + stem + '|' + r.adresse);
            const existingDup = keys.map(k => seen.get(k)).find(Boolean);
            if (existingDup) {
              if (r.score > existingDup.score) {
                Object.assign(existingDup, r);
              }
            } else {
              keys.forEach(k => seen.set(k, r));
            }
          }
          mapped = Array.from(new Set(Array.from(seen.values())));
        }
        funnel.afterDedupe = mapped.length;

        mapped.sort((a, b) => b.score - a.score);
        this.prospect.funnel = funnel;

        const candidates = mapped.slice(0, Math.min(mapped.length, this.prospect.limit * 3));
        this.prospect.toCheck = candidates.length;
        this.prospect.checked = 0;
        const concurrency = 8;
        let idx = 0;
        const worker = async () => {
          while (idx < candidates.length && this.prospect.results.length < this.prospect.limit) {
            const i = idx++;
            const r = candidates[i];
            const res = await this.checkHasWebsite(r);
            this.prospect.checked++;
            r.check = res;
            if (!res.has || this.prospect.debug) {
              this.prospect.results.push(r);
            }
          }
        };
        await Promise.all(Array.from({ length: concurrency }, worker));
        funnel.checked = this.prospect.checked;
        funnel.hasWebsite = candidates.filter(r => r.check && r.check.has).length;
        funnel.noWebsite = candidates.filter(r => r.check && !r.check.has).length;
        this.prospect.funnel = { ...funnel };
        this.prospect.results = this.prospect.results.slice(0, this.prospect.limit);
      } catch (err) {
        this.prospect.error = 'Feil: ' + err.message;
      } finally {
        this.prospect.loading = false;
      }
    },

    addProspect(r) {
      const now = Date.now();
      this.customers.push({
        id: this.uid(),
        name: r.navn,
        company: r.navn,
        phone: '',
        email: r.epost || '',
        orgnr: r.orgnr,
        status: 'lead',
        value: 0,
        notes: 'Funnet via Brreg-søk. Ingen nettside registrert.' + (r.adresse ? ' Adresse: ' + r.adresse : ''),
        created: now,
        updated: now,
      });
      r.added = true;
      this.persist();
    },

    addAllProspects() {
      this.prospect.results.forEach(r => { if (!r.added) this.addProspect(r); });
    },

    openNew() {
      this.editing = { id: null, name: '', company: '', phone: '', email: '', status: 'lead', value: 0, nextContact: '', notes: '', created: null, updated: null };
      this.modalOpen = true;
    },
    openEdit(c) { this.editing = { ...c }; this.modalOpen = true; },
    close() { this.modalOpen = false; },
    save() {
      if (!this.editing.name?.trim()) return;
      const now = Date.now();
      if (this.editing.id) {
        const i = this.customers.findIndex(c => c.id === this.editing.id);
        if (i >= 0) this.customers[i] = { ...this.editing, updated: now };
      } else {
        this.customers.push({ ...this.editing, id: this.uid(), created: now, updated: now });
      }
      this.persist();
      this.close();
    },
    exportText() {
      const sorted = [...this.customers].sort((a,b) => (b.updated||0) - (a.updated||0));
      const dato = new Date().toLocaleDateString('no-NO', { day:'2-digit', month:'long', year:'numeric' });
      const lines = [];
      lines.push('FORGE STUDIOS — KUNDELISTE');
      lines.push('Eksportert ' + dato + ' · ' + sorted.length + ' kunder');
      lines.push('');
      const groups = {};
      sorted.forEach(c => { (groups[c.status] = groups[c.status] || []).push(c); });
      for (const opt of this.statusOptions) {
        const list = groups[opt.value];
        if (!list || !list.length) continue;
        lines.push('=== ' + opt.label.toUpperCase() + ' (' + list.length + ') ===');
        lines.push('');
        list.forEach(c => {
          lines.push(c.name + (c.company ? ' — ' + c.company : ''));
          if (c.phone) lines.push('  Telefon: ' + c.phone);
          if (c.email) lines.push('  E-post: ' + c.email);
          if (c.orgnr) lines.push('  Org.nr: ' + c.orgnr);
          if (Number(c.value) > 0) lines.push('  Verdi: kr ' + Number(c.value).toLocaleString('no-NO'));
          if (c.nextContact) lines.push('  Neste kontakt: ' + c.nextContact);
          if (c.created) lines.push('  Opprettet: ' + new Date(c.created).toLocaleDateString('no-NO'));
          if (c.updated) lines.push('  Oppdatert: ' + new Date(c.updated).toLocaleDateString('no-NO'));
          if (c.notes && c.notes.trim()) {
            lines.push('  Notater:');
            c.notes.split('\n').forEach(n => lines.push('    ' + n));
          }
          lines.push('');
        });
      }
      return lines.join('\n');
    },

    async copyExport() {
      const text = this.exportText();
      try {
        await navigator.clipboard.writeText(text);
        alert('Kopiert! ' + this.customers.length + ' kunder ligger nå på utklippstavlen — lim inn i Docs med Ctrl+V.');
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Kopiert! Lim inn i Docs med Ctrl+V.');
      }
    },

    downloadExport() {
      const text = this.exportText();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'forge-crm-' + new Date().toISOString().slice(0,10) + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    async remove() {
      if (!confirm('Slette ' + this.editing.name + '?')) return;
      const id = this.editing.id;
      this.customers = this.customers.filter(c => c.id !== id);
      await this.deleteCustomer(id);
      this.close();
    },
  };
}
