(function(){
      'use strict';

      const KG_TO_LB = 2.2046226218487757; // More precise constant
      const LB_TO_KG = 1 / KG_TO_LB;

      const el = (id) => document.getElementById(id);

      const input = el('inputValue');
      const output = el('outputValue');
      const decimals = el('decimals');
      const decimalsVal = el('decimalsVal');
      const factor = el('factor');
      const swapBtn = el('swapBtn');
      const copyBtn = el('copyBtn');
      const clearBtn = el('clearBtn');
      const pasteBtn = el('pasteBtn');
      const converter = document.getElementById('converter');

      const fromLabel = el('fromLabel');
      const toLabel = el('toLabel');
      const fromUnit = el('fromUnit');
      const toUnit = el('toUnit');
      const toast = el('toast');

      const formatNumber = (num, dec) => {
        if (!isFinite(num)) return '';
        return Number(num).toLocaleString(undefined, {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec
        });
      };

      const parseInput = (val) => {
        if (typeof val !== 'string') return NaN;
        // allow commas and spaces
        const cleaned = val.replace(/[^0-9+\-\.eE]/g, '');
        return Number(cleaned);
      };

      const updateFactorLabel = () => {
        const dir = converter.getAttribute('data-direction');
        if (dir === 'kg2lb'){
          factor.textContent = `1 kg = ${KG_TO_LB} lb`;
        } else {
          factor.textContent = `1 lb = ${LB_TO_KG} kg`;
        }
      };

      const convert = () => {
        const dir = converter.getAttribute('data-direction');
        const dec = Number(decimals.value);
        decimalsVal.textContent = dec;

        const raw = parseInput(input.value);
        if (isNaN(raw)){
          output.value = '';
          return;
        }
        let res;
        if (dir === 'kg2lb'){
          res = raw * KG_TO_LB;
        } else {
          res = raw * LB_TO_KG;
        }
        output.value = formatNumber(res, dec);
      };

      const swap = () => {
        const dir = converter.getAttribute('data-direction');
        const newDir = dir === 'kg2lb' ? 'lb2kg' : 'kg2lb';
        converter.setAttribute('data-direction', newDir);
        const from = newDir === 'kg2lb' ? ['Kilograms','kg'] : ['Pounds','lb'];
        const to = newDir === 'kg2lb' ? ['Pounds','lb'] : ['Kilograms','kg'];
        fromLabel.textContent = from[0];
        fromUnit.textContent = from[1];
        toLabel.textContent = to[0];
        toUnit.textContent = to[1];
        input.setAttribute('aria-label', `Input weight in ${from[0].toLowerCase()}`);
        output.setAttribute('aria-label', `Converted weight in ${to[0].toLowerCase()}`);
        updateFactorLabel();
        // Recalculate with same numeric meaning after swap by moving value over
        const outNum = parseInput(output.value);
        if (isFinite(outNum)){
          input.value = outNum;
        }
        convert();
      };

      const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
      };

      // Event listeners
      ['input','change','keyup','paste'].forEach(evt => input.addEventListener(evt, convert));
      decimals.addEventListener('input', convert);
      swapBtn.addEventListener('click', swap);

      copyBtn.addEventListener('click', async () => {
        if (!output.value){ showToast('Nothing to copy'); return; }
        try{
          await navigator.clipboard.writeText(output.value);
          showToast('Copied ✔');
        }catch(e){
          // fallback
          output.select();
          document.execCommand('copy');
          showToast('Copied ✔');
        }
      });

      clearBtn.addEventListener('click', () => {
        input.value = '';
        output.value = '';
        input.focus();
      });

      pasteBtn.addEventListener('click', async () => {
        try{
          const text = await navigator.clipboard.readText();
          if (text){
            input.value = text;
            convert();
            showToast('Pasted 📌');
          } else {
            showToast('Clipboard is empty');
          }
        }catch(e){
          showToast('Clipboard not available');
        }
      });

      // Keyboard niceties
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter'){ output.focus(); }
      });

      // Init
      updateFactorLabel();
      convert();
    })();
