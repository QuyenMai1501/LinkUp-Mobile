# find.ps1 - tim kiem code theo tu khoa (ten file + noi dung) qua git.
# Cach dung: npm run find -- <tu khoa>

param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Keywords
)

if (-not $Keywords -or $Keywords.Count -eq 0) {
  Write-Host "Cach dung: npm run find -- <tu khoa>"
  Write-Host "Vi du:     npm run find -- chat"
  Write-Host "           npm run find -- useChatSocket"
  exit 1
}

$kw = $Keywords -join ' '

Write-Host "=== 1. Ten file chua '$kw' ==="
$nameHits = git ls-files | Select-String -SimpleMatch -Pattern $kw
if ($nameHits) {
  $nameHits | ForEach-Object { $_.Line }
} else {
  Write-Host "(khong co file nao)"
}

Write-Host ""
Write-Host "=== 2. Noi dung match '$kw' (gioi han 200 dong dau, bo qua json/lock) ==="
$contentHits = git grep -in -I -e $kw -- ':!*.json' ':!package-lock.json' ':!*.svg' 2>$null
if ($contentHits) {
  $contentHits | Select-Object -First 200
  $total = @($contentHits).Count
  if ($total -gt 200) {
    Write-Host ""
    Write-Host "... (tat ca $total dong match - chay lai va lay tu khoa hep hon)"
  }
} else {
  Write-Host "(khong co match noi dung nao)"
}
