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
      onlyActive: true,
      onlyMva: false,
      hideEnk: false,
      dedupe: true,
      trades: [
        { code: '43.22', label: 'Rørlegger (VVS)' },
        { code: '43.21', label: 'Elektriker' },
        { code: '43.32', label: 'Snekker / innredning' },
        { code: '43.34', label: 'Maler / glassarbeid' },
        { code: '43.31', label: 'Murer / pussing' },
        { code: '43.91', label: 'Taktekker' },
        { code: '43.99', label: 'Annet bygg / spesialisert' },
        { code: '41.20', label: 'Bygg av bolig / yrkesbygg' },
        { code: '81.30', label: 'Hage / anleggsgartner' },
        { code: '96.02', label: 'Frisør / skjønnhetspleie' },
        { code: '96.04', label: 'Hud, massasje, velvære' },
        { code: '45.20', label: 'Bilverksted' },
        { code: '95.22', label: 'Reparasjon hvitevarer' },
        { code: '49.41', label: 'Transport / lastebil' },
        { code: '49.32', label: 'Drosje' },
        { code: '56.10', label: 'Restaurant / kafé' },
        { code: '74.20', label: 'Fotograf' },
        { code: '93.13', label: 'Treningssenter' },
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

    init() {
      const saved = localStorage.getItem('forge-crm-v2');
      if (saved) {
        try { this.customers = JSON.parse(saved); } catch(e) {}
      }
      if (this.customers.length === 0) {
        this.customers = [
          { id: this.uid(), name: 'Kari Hansen', company: 'Hansen Frisør', phone: '+47 911 22 333', email: 'kari@hansenfrisor.no', status: 'called', value: 15000, notes: 'Veldig interessert. Sender tilbud i morgen.', created: Date.now()-86400000*3, updated: Date.now()-86400000 },
          { id: this.uid(), name: 'Per Olsen', company: 'Olsen Bygg AS', phone: '+47 922 33 444', email: '', status: 'lead', value: 0, notes: 'Tips fra Lars. Ringe mandag.', created: Date.now()-86400000*2, updated: Date.now()-86400000*2 },
          { id: this.uid(), name: 'Ingrid Berg', company: 'Berg Tannlege', phone: '+47 933 44 555', email: 'post@bergtannlege.no', status: 'won', value: 25000, notes: 'Signert kontrakt.', created: Date.now()-86400000*14, updated: Date.now()-86400000*5 },
        ];
        this.persist();
      }
      this.tick();
      setInterval(() => this.tick(), 1000);
    },

    tick() {
      const d = new Date();
      this.clock = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    },

    persist() { localStorage.setItem('forge-crm-v2', JSON.stringify(this.customers)); },
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

    async runProspect() {
      this.prospect.loading = true;
      this.prospect.error = '';
      this.prospect.results = [];
      this.prospect.totalScanned = 0;
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

        const existing = new Set(this.customers.map(c => (c.orgnr || '').toString()));
        let mapped = list
          .filter(e => !e.slettedato && !e.konkurs && !e.underAvvikling && !e.underTvangsavviklingEllerTvangsopplosning)
          .filter(e => !e.hjemmeside || !e.hjemmeside.trim())
          .map(e => {
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
          mapped = mapped.filter(r => r.ansatte >= 1 || r.mva);
        }
        if (this.prospect.onlyMva) {
          mapped = mapped.filter(r => r.mva);
        }
        if (this.prospect.hideEnk) {
          mapped = mapped.filter(r => r.orgform !== 'ENK');
        }

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

        mapped.sort((a, b) => b.score - a.score);
        this.prospect.results = mapped.slice(0, this.prospect.limit);
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
    remove() {
      if (!confirm('Slette ' + this.editing.name + '?')) return;
      this.customers = this.customers.filter(c => c.id !== this.editing.id);
      this.persist();
      this.close();
    },
  };
}
