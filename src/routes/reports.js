const express = require('express');
const passService = require('../services/passService');
const dt = require('../config/datetime');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

const router = express.Router();

const fontsDir = path.join(__dirname, '..', 'public', 'assets', 'fonts');
const fontRegular = path.join(fontsDir, 'Roboto-Regular.ttf');
const fontBold = path.join(fontsDir, 'Roboto-Bold.ttf');

function registerFonts(doc) {
  if (fs.existsSync(fontRegular) && fs.existsSync(fontBold)) {
    doc.registerFont('Roboto', fontRegular);
    doc.registerFont('Roboto-Bold', fontBold);
    return { regular: 'Roboto', bold: 'Roboto-Bold' };
  }
  return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
}

function formatCRC(value) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNum(value) {
  return new Intl.NumberFormat('es-CR').format(value || 0);
}

router.use((req, res, next) => {
  res.locals.formatCRC = formatCRC;
  next();
});

router.get('/', async (req, res, next) => {
  try {
    const fin = dt.todayISO();
    const inicio = dt.addDaysISO(fin, -29);

    const fechaDesde = req.query.fechaDesde || inicio;
    const fechaHasta = req.query.fechaHasta || fin;

    const report = await passService.getReport(fechaDesde, fechaHasta);

    res.render('reports/index', {
      title: 'Reportes',
      active: 'reports',
      report,
      fechaDesde,
      fechaHasta,
    });
  } catch (err) { next(err); }
});

/* ============================================================
   Exportar reporte como PDF profesional
   ============================================================ */
function drawTable(doc, columns, rows, options = {}) {
  const {
    startX = doc.page.margins.left,
    startY = doc.y,
    fontSize = 8.5,
    headerColor = '#1d401a',
    headerTextColor = '#ffffff',
    alternateRowColor = '#f8fafc',
    borderColor = '#e2e8f0',
    maxY = doc.page.height - doc.page.margins.bottom - 30,
    fonts = { regular: 'Helvetica', bold: 'Helvetica-Bold' },
    cellPadding = { top: 6, bottom: 6, left: 11, right: 11 },
    minRowHeight = 22,
  } = options;

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, c) => sum + (c.weight || 1), 0);

  function colX(index) {
    let x = startX;
    for (let i = 0; i < index; i++) {
      x += (columns[i].weight || 1) / totalWeight * usableWidth;
    }
    return x;
  }

  function colWidth(index) {
    return (columns[index].weight || 1) / totalWeight * usableWidth;
  }

  function innerWidth(index) {
    return colWidth(index) - cellPadding.left - cellPadding.right;
  }

  function measureRowHeight(row, isHeader = false) {
    let h = 0;
    const font = isHeader ? fonts.bold : fonts.regular;
    doc.font(font).fontSize(fontSize);
    columns.forEach((col, i) => {
      const value = isHeader
        ? col.title
        : (col.format ? col.format(row[col.key], row) : (row[col.key] || '—'));
      const textH = doc.heightOfString(String(value), {
        width: innerWidth(i),
        align: col.align || 'left',
      });
      h = Math.max(h, textH + cellPadding.top + cellPadding.bottom);
    });
    return Math.max(h, minRowHeight);
  }

  function drawHeader(y, headerHeight) {
    doc.save();
    doc.rect(startX, y, usableWidth, headerHeight).fill(headerColor);
    doc.restore();

    doc.fillColor(headerTextColor).fontSize(fontSize).font(fonts.bold);
    columns.forEach((col, i) => {
      const x = colX(i);
      const align = col.align || 'left';
      doc.text(col.title, x + cellPadding.left, y + cellPadding.top, {
        width: innerWidth(i),
        align,
        baseline: 'top',
      });
    });
  }

  // Header
  const initialHeaderHeight = measureRowHeight(null, true);
  drawHeader(startY, initialHeaderHeight);

  // Rows
  doc.font(fonts.regular).fontSize(fontSize).fillColor('#334155');
  let y = startY + initialHeaderHeight;

  rows.forEach((row, rowIndex) => {
    const rowHeight = measureRowHeight(row);

    if (y + rowHeight > maxY) {
      doc.addPage();
      y = doc.page.margins.top;
      const newHeaderHeight = measureRowHeight(null, true);
      drawHeader(y, newHeaderHeight);
      y += newHeaderHeight;
      doc.font(fonts.regular).fontSize(fontSize).fillColor('#334155');
    }

    if (rowIndex % 2 === 1) {
      doc.save();
      doc.rect(startX, y, usableWidth, rowHeight).fill(alternateRowColor);
      doc.restore();
    }

    // Cell borders (vertical + bottom)
    doc.save();
    doc.strokeColor(borderColor).lineWidth(0.5);
    columns.forEach((col, i) => {
      if (i > 0) {
        const x = colX(i);
        doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
      }
    });
    doc.moveTo(startX, y + rowHeight).lineTo(startX + usableWidth, y + rowHeight).stroke();
    doc.restore();

    columns.forEach((col, i) => {
      const x = colX(i);
      const align = col.align || 'left';
      const value = col.format ? col.format(row[col.key], row) : (row[col.key] || '—');
      doc.text(String(value), x + cellPadding.left, y + cellPadding.top, {
        width: innerWidth(i),
        align,
        baseline: 'top',
      });
    });

    y += rowHeight;
  });

  doc.y = y + 8;
}

router.get('/exportar.pdf', async (req, res, next) => {
  try {
    const fin = dt.todayISO();
    const inicio = dt.addDaysISO(fin, -29);

    const fechaDesde = req.query.fechaDesde || inicio;
    const fechaHasta = req.query.fechaHasta || fin;

    const report = await passService.getReport(fechaDesde, fechaHasta);
    const t = report.totals;

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const filename = `reporte-pozablanca_${fechaDesde}_${fechaHasta}.pdf`;

  const chunks = [];
  const bufferStream = new stream.PassThrough();
  bufferStream.on('data', (chunk) => chunks.push(chunk));
  doc.pipe(bufferStream);

  const fonts = registerFonts(doc);
  const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo.png');
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;

  // Logo
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, margin, 35, { width: 52 });
  }

  // Header text
  doc.fontSize(22).font(fonts.bold).fillColor('#1d401a')
    .text('Poza Blanca Lodge', margin + 64, 38);
  doc.fontSize(10).font(fonts.regular).fillColor('#64748b')
    .text('Hotel Boutique · San Mateo, Alajuela, Costa Rica', margin + 64, 64);

  // Title
  doc.moveDown(1.2);
  doc.fontSize(16).font(fonts.bold).fillColor('#0f172a')
    .text('Reporte de ingresos por período', margin, doc.y);
  doc.fontSize(10).font(fonts.regular).fillColor('#64748b')
    .text(`Del ${fechaDesde} al ${fechaHasta}`, margin, doc.y + 4);

  doc.moveDown(0.8);

  // Totals bar
  const totalsY = doc.y;
  const boxWidth = (pageWidth - margin * 2 - 24) / 4;
  const totals = [
    { label: 'Total pases', value: formatNum(t.totalPases), color: '#1d401a' },
    { label: 'Personas', value: formatNum(t.totalPersonas), color: '#1d401a' },
    { label: 'Ingresos', value: formatCRC(t.montoTotal), color: '#41a61f' },
    { label: 'Pendiente', value: formatCRC(t.montoPendiente), color: '#d4a843' },
  ];

  totals.forEach((item, i) => {
    const x = margin + i * (boxWidth + 8);
    doc.save();
    doc.roundedRect(x, totalsY, boxWidth, 52, 6).fill('#f8fafc').stroke('#e2e8f0');
    doc.restore();
    doc.fontSize(9).font(fonts.regular).fillColor('#64748b')
      .text(item.label, x + 12, totalsY + 10);
    doc.fontSize(13).font(fonts.bold).fillColor(item.color)
      .text(item.value, x + 12, totalsY + 26);
  });

  doc.y = totalsY + 58;

  // Resumen por día
  if (report.porDia.length > 0) {
    doc.fontSize(12).font(fonts.bold).fillColor('#0f172a')
      .text('Resumen por día', margin, doc.y);
    doc.moveDown(0.3);

    drawTable(doc, [
      { title: 'Fecha', key: 'fecha', weight: 2 },
      { title: 'Pases', key: 'pases', align: 'right', weight: 1 },
      { title: 'Personas', key: 'personas', align: 'right', weight: 1 },
      { title: 'Monto', key: 'monto', align: 'right', weight: 1.5, format: (v) => formatCRC(v) },
    ], report.porDia, { fonts });

    doc.moveDown(0.5);
  }

    // Detalle
    if (report.rows.length > 0) {
      doc.fontSize(12).font(fonts.bold).fillColor('#0f172a')
        .text('Detalle de pases', margin, doc.y);
      doc.moveDown(0.3);

      const tipoPaseLabels = { rio: 'Río', camping: 'Camping', rancho: 'Rancho', piscina: 'Piscina', parqueo: 'Parqueo' };
      const formaPagoLabels = { efectivo: 'Efectivo', sinpe: 'Sinpe', tarjeta: 'Tarjeta' };

      drawTable(doc, [
        { title: 'Fecha', key: 'fecha', weight: 0.85 },
        { title: 'Visitante', key: 'nombre', weight: 1.8 },
        { title: 'Tipo', key: 'tipo_pase', weight: 0.7, format: (v) => tipoPaseLabels[v] || '—' },
        { title: 'Ad.', key: 'adultos', align: 'right', weight: 0.45, format: (v, r) => String(v || r.cantidad_personas) },
        { title: 'Niños', key: 'ninos', align: 'right', weight: 0.45 },
        { title: 'Pago', key: 'forma_pago', weight: 0.65, format: (v) => formaPagoLabels[v] || '—' },
        { title: 'Monto', key: 'monto', align: 'right', weight: 0.8, format: (v) => formatCRC(v) },
        { title: 'Estado', key: 'estado_pago', weight: 0.65, format: (v) => v === 'pagado' ? 'Pagado' : 'Pend.' },
      ], report.rows, { fonts });
    }

  doc.end();

  bufferStream.on('end', async () => {
    try {
      const pdfBuffer = Buffer.concat(chunks);
      const pdfDoc = await PDFLibDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const footerPrefix = `Generado el ${dt.todayISO()} · Poza Blanca Lodge · Página `;
      const footerColor = rgb(0.58, 0.64, 0.72);

      pdfDoc.getPages().forEach((page, i) => {
        const { width } = page.getSize();
        const footerFull = `${footerPrefix}${i + 1} de ${totalPages}`;
        const textWidth = helvetica.widthOfTextAtSize(footerFull, 8);
        page.drawText(footerFull, {
          x: (width - textWidth) / 2,
          y: 28,
          size: 8,
          font: helvetica,
          color: footerColor,
        });
      });

      const finalPdf = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(finalPdf);
    } catch (err) {
      console.error(err);
      req.flash('error', 'No se pudo generar el PDF.');
      res.redirect('/reportes');
    }
  });
  } catch (err) { next(err); }
});

module.exports = router;
