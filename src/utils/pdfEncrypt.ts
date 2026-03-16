import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Encrypt a PDF buffer with a password using the `qpdf` CLI.
 *
 * - Requires `qpdf` to be installed on the server (e.g. `apt install qpdf`).
 * - Optionally configure binary path via QPDF_BIN env (defaults to "qpdf").
 * - If qpdf is not available or fails, the original buffer is returned unchanged.
 */
export const encryptPdfBufferWithPassword = async (
  pdfBuffer: Buffer,
  password: string
): Promise<Buffer> => {
  const qpdfBin = process.env.QPDF_BIN || 'qpdf';

  // If no password, just return original buffer
  if (!password || !password.trim()) {
    return pdfBuffer;
  }

  const tmpDir = os.tmpdir();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tmpDir, `consent-${unique}.pdf`);
  const outputPath = path.join(tmpDir, `consent-${unique}-enc.pdf`);

  try {
    await fs.writeFile(inputPath, pdfBuffer);

    await new Promise<void>((resolve, reject) => {
      const args = ['--encrypt', password, password, '256', '--', inputPath, outputPath];
      const child = spawn(qpdfBin, args);
      let stderr = '';

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        // qpdf exit codes:
        // 0 = success, 3 = success with warnings (output file still written).
        if (code === 0 || code === 3) {
          if (code === 3) {
            console.warn('[PDF] qpdf reported warnings during encryption:', stderr.trim());
          }
          resolve();
        } else {
          reject(new Error(`qpdf exited with code ${code}: ${stderr}`));
        }
      });
    });

    const encrypted = await fs.readFile(outputPath);
    return encrypted;
  } catch (error: any) {
    console.warn('[PDF] qpdf encryption failed, sending unencrypted PDF:', error.message);
    return pdfBuffer;
  } finally {
    // Best-effort cleanup
    try {
      await fs.unlink(inputPath);
    } catch {}
    try {
      await fs.unlink(outputPath);
    } catch {}
  }
};

