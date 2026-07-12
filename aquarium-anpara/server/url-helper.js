function enc(n) {
  return Buffer.from(String(n)).toString('base64url').replace(/=+$/, '');
}
function dec(s) {
  return Number(Buffer.from(s, 'base64url').toString());
}
module.exports = { enc, dec };