import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import {
  addMinutesToTime,
  CondoMeetingDTO,
  formatMeetingDateLong,
} from '@/lib/meetings';

const WINANSI_EXTRAS = new Set([
  '€', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', 'Ž',
  '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', 'ž', 'Ÿ',
]);

export function sanitizeWinAnsi(text: string): string {
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/✓|✔/g, 'v')
    .replace(/☐/g, '[ ]');

  let out = '';
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (
      ch === '\n' ||
      ch === '\r' ||
      ch === '\t' ||
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff) ||
      WINANSI_EXTRAS.has(ch)
    ) {
      out += ch;
    }
  }
  return out;
}

interface WrappedLine {
  text: string;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): WrappedLine[] {
  const safe = sanitizeWinAnsi(text);
  const paragraphs = safe.split(/\r?\n/);
  const lines: WrappedLine[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push({ text: '' });
      continue;
    }

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push({ text: currentLine });
        currentLine = words[i];
      }
    }
    lines.push({ text: currentLine });
  }

  return lines;
}

interface TextSegment {
  text: string;
  bold?: boolean;
}

interface RichToken {
  word: string;
  bold: boolean;
}

interface RichLine {
  tokens: RichToken[];
}

function wrapRichSegments(
  segments: TextSegment[],
  regularFont: PDFFont,
  boldFont: PDFFont,
  fontSize: number,
  maxWidth: number
): RichLine[] {
  const tokens: RichToken[] = [];
  for (const seg of segments) {
    const clean = sanitizeWinAnsi(seg.text);
    const parts = clean.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      tokens.push({ word: part, bold: Boolean(seg.bold) });
    }
  }

  if (tokens.length === 0) return [];

  const lines: RichLine[] = [];
  let current: RichToken[] = [];
  let currentWidth = 0;
  const spaceWidth = regularFont.widthOfTextAtSize(' ', fontSize);

  for (const token of tokens) {
    const font = token.bold ? boldFont : regularFont;
    const tokenWidth = font.widthOfTextAtSize(token.word, fontSize);
    const addedWidth = current.length === 0 ? tokenWidth : spaceWidth + tokenWidth;

    if (current.length > 0 && currentWidth + addedWidth > maxWidth) {
      lines.push({ tokens: current });
      current = [token];
      currentWidth = tokenWidth;
    } else {
      current.push(token);
      currentWidth += addedWidth;
    }
  }

  if (current.length > 0) {
    lines.push({ tokens: current });
  }

  return lines;
}

function drawRichLines(
  page: PDFPage,
  lines: RichLine[],
  startX: number,
  startY: number,
  lineHeight: number,
  fontSize: number,
  regularFont: PDFFont,
  boldFont: PDFFont,
  color: ReturnType<typeof rgb>
): number {
  let y = startY;
  const spaceWidth = regularFont.widthOfTextAtSize(' ', fontSize);

  for (const line of lines) {
    let x = startX;
    line.tokens.forEach((token, idx) => {
      const font = token.bold ? boldFont : regularFont;
      if (idx > 0) x += spaceWidth;
      page.drawText(token.word, { x, y, size: fontSize, font, color });
      x += font.widthOfTextAtSize(token.word, fontSize);
    });
    y -= lineHeight;
  }

  return y;
}

export async function generateConvocationPdf({
  meeting,
  buildingName,
}: {
  meeting: CondoMeetingDTO;
  buildingName: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  pdfDoc.setTitle(
    sanitizeWinAnsi(`Convocatória — Assembleia Geral ${meeting.assemblyType} (Acta N.º ${meeting.actaNumber})`)
  );
  pdfDoc.setAuthor(sanitizeWinAnsi(meeting.adminSigners || buildingName));

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 50;
  const contentWidth = pageWidth - marginX * 2;
  const topY = pageHeight - 46;
  const bottomMinY = 44;
  const maxContentHeight = topY - bottomMinY;

  const firstTime = meeting.firstConvocationTime || '21:30';
  const secondTime = addMinutesToTime(firstTime, 30);
  const meetingDateLong = formatMeetingDateLong(meeting.meetingDate);
  const issueDateLong = meeting.issueDate
    ? formatMeetingDateLong(meeting.issueDate)
    : formatMeetingDateLong(new Date().toISOString().slice(0, 10));

  const agendaTitles = meeting.discussionPoints
    .map((pt) => pt.title.trim())
    .filter(Boolean);

  const darkInk = rgb(0.06, 0.09, 0.16);
  const bodyInk = rgb(0.12, 0.16, 0.22);
  const mutedInk = rgb(0.32, 0.36, 0.44);
  const borderGray = rgb(0.75, 0.78, 0.83);
  const boxBg = rgb(0.975, 0.98, 0.99);
  const calloutBg = rgb(0.975, 0.98, 0.985);

  function layoutAndOptionallyDraw(scale: number, page?: PDFPage): number {
    let y = topY;

    const kickerSize = 8.5 * scale;
    const buildingSize = 11.5 * scale;
    const titleSize = 16.5 * scale;
    const bodySize = 10.5 * scale;
    const bodyLH = 15 * scale;
    const agendaTitleSize = 10 * scale;
    const agendaItemSize = 10 * scale;
    const agendaLH = 14 * scale;
    const calloutSize = 9 * scale;
    const calloutLH = 12.8 * scale;
    const noteSize = 9 * scale;
    const noteLH = 12.5 * scale;
    const footerSize = 9.5 * scale;
    const footerLH = 13 * scale;

    // 1. Header
    const kickerText = sanitizeWinAnsi('CONDOMÍNIO DO PRÉDIO SITO NA');
    const kickerW = boldFont.widthOfTextAtSize(kickerText, kickerSize);
    if (page) {
      page.drawText(kickerText, {
        x: (pageWidth - kickerW) / 2,
        y,
        size: kickerSize,
        font: boldFont,
        color: mutedInk,
      });
    }
    y -= 15 * scale;

    const bldgText = sanitizeWinAnsi(buildingName);
    const bldgW = boldFont.widthOfTextAtSize(bldgText, buildingSize);
    if (page) {
      page.drawText(bldgText, {
        x: (pageWidth - bldgW) / 2,
        y,
        size: buildingSize,
        font: boldFont,
        color: darkInk,
      });
    }
    y -= 24 * scale;

    const titleText = sanitizeWinAnsi('CONVOCATÓRIA');
    const titleW = boldFont.widthOfTextAtSize(titleText, titleSize);
    const titleX = (pageWidth - titleW) / 2;
    if (page) {
      page.drawText(titleText, {
        x: titleX,
        y,
        size: titleSize,
        font: boldFont,
        color: darkInk,
      });
      page.drawLine({
        start: { x: titleX, y: y - 3 },
        end: { x: titleX + titleW, y: y - 3 },
        thickness: 1.2,
        color: darkInk,
      });
    }
    y -= 14 * scale;

    if (page) {
      page.drawLine({
        start: { x: marginX, y },
        end: { x: pageWidth - marginX, y },
        thickness: 1.5,
        color: darkInk,
      });
    }
    y -= 22 * scale;

    // 2. Greeting + Opening paragraph
    if (page) {
      page.drawText(sanitizeWinAnsi('Exmo.(a) Senhor(a) Condómino(a),'), {
        x: marginX,
        y,
        size: bodySize,
        font: boldFont,
        color: darkInk,
      });
    }
    y -= 18 * scale;

    const openingLines = wrapRichSegments(
      [
        {
          text: 'Nos termos do n.º 2 do artigo 1431.º e do n.º 1 do artigo 1432.º do Código Civil, fica V.ª Ex.ª convocado(a) para a ',
        },
        { text: `Assembleia Geral ${meeting.assemblyType} de Condóminos`, bold: true },
        { text: ', a realizar no dia ' },
        { text: meetingDateLong.toUpperCase(), bold: true },
        { text: ', pelas ' },
        { text: `${firstTime} horas`, bold: true },
        { text: ', no ' },
        { text: meeting.location, bold: true },
        { text: ', com a seguinte:' },
      ],
      regularFont,
      boldFont,
      bodySize,
      contentWidth
    );
    if (page) {
      y = drawRichLines(page, openingLines, marginX, y, bodyLH, bodySize, regularFont, boldFont, bodyInk);
    } else {
      y -= openingLines.length * bodyLH;
    }
    y -= 10 * scale;

    // 3. Ordem de Trabalhos Box
    const boxPadX = 16 * scale;
    const boxPadTop = 14 * scale;
    const boxPadBottom = 10 * scale;
    const agendaInnerW = contentWidth - boxPadX * 2 - 18 * scale;

    const wrappedAgendaItems = agendaTitles.map((t, idx) => ({
      num: `${idx + 1}.`,
      lines: wrapText(t, regularFont, agendaItemSize, agendaInnerW),
    }));

    const totalAgendaLineCount = wrappedAgendaItems.reduce(
      (sum, item) => sum + Math.max(1, item.lines.length),
      0
    );
    const agendaGap = Math.max(0, wrappedAgendaItems.length - 1) * (4 * scale);
    const boxContentHeight =
      boxPadTop +
      16 * scale +
      Math.max(1, totalAgendaLineCount) * agendaLH +
      agendaGap +
      boxPadBottom;

    const boxTopY = y;
    const boxBottomY = boxTopY - boxContentHeight;
    if (page) {
      page.drawRectangle({
        x: marginX,
        y: boxBottomY,
        width: contentWidth,
        height: boxContentHeight,
        color: boxBg,
        borderColor: borderGray,
        borderWidth: 0.9,
      });

      let ay = boxTopY - boxPadTop - 2;
      page.drawText(sanitizeWinAnsi('ORDEM DE TRABALHOS'), {
        x: marginX + boxPadX,
        y: ay,
        size: agendaTitleSize,
        font: boldFont,
        color: darkInk,
      });
      ay -= 17 * scale;

      if (wrappedAgendaItems.length === 0) {
        page.drawText(sanitizeWinAnsi('Sem pontos registados na ordem de trabalhos.'), {
          x: marginX + boxPadX,
          y: ay,
          size: agendaItemSize,
          font: italicFont,
          color: mutedInk,
        });
      } else {
        for (const item of wrappedAgendaItems) {
          page.drawText(item.num, {
            x: marginX + boxPadX,
            y: ay,
            size: agendaItemSize,
            font: boldFont,
            color: darkInk,
          });
          for (const line of item.lines) {
            page.drawText(line.text, {
              x: marginX + boxPadX + 18 * scale,
              y: ay,
              size: agendaItemSize,
              font: regularFont,
              color: darkInk,
            });
            ay -= agendaLH;
          }
          ay -= 4 * scale;
        }
      }
    }

    y = boxBottomY - 16 * scale;

    // 4. Legal 2.ª convocatória callout
    const calloutPadX = 14 * scale;
    const calloutPadY = 10 * scale;
    const calloutLines = wrapRichSegments(
      [
        {
          text: 'Na reunião da Assembleia de Condóminos acima referida, se não estiverem presentes ou representados condóminos titulares da maioria dos votos representativos do capital investido no prédio, ou não for possível formar a maioria prevista no n.º 3 do art.º 1432.º do Código Civil, fica também desde já convocada nova reunião da Assembleia de Condóminos a realizar no ',
        },
        {
          text: `mesmo dia e no mesmo local, trinta minutos depois (${secondTime} horas)`,
          bold: true,
        },
        {
          text: ', com a mesma ordem de trabalhos, a qual poderá deliberar por maioria dos votos dos proprietários presentes, desde que representem pelo menos um quarto do valor total do prédio, nos termos do n.º 4 do citado art.º 1432.º do Código Civil.',
        },
      ],
      regularFont,
      boldFont,
      calloutSize,
      contentWidth - calloutPadX - 10 * scale
    );
    const calloutHeight = calloutPadY * 2 + calloutLines.length * calloutLH;
    const calloutBottomY = y - calloutHeight;

    if (page) {
      page.drawRectangle({
        x: marginX,
        y: calloutBottomY,
        width: contentWidth,
        height: calloutHeight,
        color: calloutBg,
      });
      page.drawRectangle({
        x: marginX,
        y: calloutBottomY,
        width: 3,
        height: calloutHeight,
        color: rgb(0.24, 0.28, 0.34),
      });
      drawRichLines(
        page,
        calloutLines,
        marginX + calloutPadX,
        y - calloutPadY - calloutSize * 0.8,
        calloutLH,
        calloutSize,
        regularFont,
        boldFont,
        bodyInk
      );
    }
    y = calloutBottomY - 16 * scale;

    // 5. Extra note
    if (meeting.extraNote && meeting.extraNote.trim()) {
      const extraLines = wrapText(meeting.extraNote.trim(), italicFont, noteSize, contentWidth);
      if (page) {
        for (const line of extraLines) {
          page.drawText(line.text, {
            x: marginX,
            y,
            size: noteSize,
            font: italicFont,
            color: mutedInk,
          });
          y -= noteLH;
        }
      } else {
        y -= extraLines.length * noteLH;
      }
      y -= 10 * scale;
    }

    // 6. Closing paragraph
    const closingLines = wrapText(
      'A sua comparência e participação são muito importantes para a gestão do nosso edifício.',
      regularFont,
      bodySize,
      contentWidth
    );
    if (page) {
      for (const line of closingLines) {
        page.drawText(line.text, {
          x: marginX,
          y,
          size: bodySize,
          font: regularFont,
          color: bodyInk,
        });
        y -= bodyLH;
      }
    } else {
      y -= closingLines.length * bodyLH;
    }
    y -= 6 * scale;

    if (page) {
      page.drawText(sanitizeWinAnsi('Com os melhores cumprimentos,'), {
        x: marginX,
        y,
        size: bodySize,
        font: regularFont,
        color: bodyInk,
      });
    }
    y -= 34 * scale;

    // 7. Footer: issue date on left, signature block on right
    const signerLines = sanitizeWinAnsi(meeting.adminSigners || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (page) {
      const datePrefix = sanitizeWinAnsi('Monte Abraão — Queluz, ');
      const datePrefixW = regularFont.widthOfTextAtSize(datePrefix, footerSize);
      page.drawText(datePrefix, {
        x: marginX,
        y,
        size: footerSize,
        font: regularFont,
        color: bodyInk,
      });
      page.drawText(sanitizeWinAnsi(issueDateLong), {
        x: marginX + datePrefixW,
        y,
        size: footerSize,
        font: boldFont,
        color: darkInk,
      });

      const sigWidth = 215;
      const sigX = pageWidth - marginX - sigWidth;
      page.drawLine({
        start: { x: sigX, y: y + 12 * scale },
        end: { x: sigX + sigWidth, y: y + 12 * scale },
        thickness: 0.9,
        color: darkInk,
      });

      let sy = y;
      for (const sLine of signerLines) {
        const w = boldFont.widthOfTextAtSize(sLine, footerSize);
        page.drawText(sLine, {
          x: sigX + Math.max(0, (sigWidth - w) / 2),
          y: sy,
          size: footerSize,
          font: boldFont,
          color: darkInk,
        });
        sy -= footerLH;
      }
    }

    const totalHeightUsed = topY - (y - Math.max(0, signerLines.length - 1) * footerLH);
    return totalHeightUsed;
  }

  const candidateScales = [1.0, 0.94, 0.88, 0.82, 0.76, 0.7];
  let chosenScale = candidateScales[candidateScales.length - 1];
  for (const sc of candidateScales) {
    if (layoutAndOptionallyDraw(sc) <= maxContentHeight) {
      chosenScale = sc;
      break;
    }
  }

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  layoutAndOptionallyDraw(chosenScale, page);

  return pdfDoc.save();
}
