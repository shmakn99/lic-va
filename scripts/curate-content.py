"""Reproduce the manually selected passages. Check resulting files before changing them."""
import json, pathlib, re
from prepare_sources import DOCS

root = pathlib.Path(__file__).resolve().parent.parent
manifest = []
def build(plan, title, selections, gaps):
    text = (root / '.local/sources' / (plan + '.txt')).read_text(encoding='utf-8')
    pages = dict((int(n), t) for n, t in re.findall(r'=== PDF PAGE (\d+) ===\n(.*?)(?==== PDF PAGE|\Z)', text, re.S))
    output = [f'# {title}\n\nSource edition checked 6 October 2026. PDF page numbers below are one-based.\n\n## Explicit coverage gaps\n{gaps}\n']
    for sid, label, nums, start, end in selections:
        passage = '\n'.join(re.sub(r'\n\s*\d{1,2}\s*$', '', re.sub(r'^\s*\d{1,2}\s*\n', '', pages[n])) for n in nums)
        if start: passage = passage[passage.index(start):]
        if end: passage = passage[:passage.index(end)]
        passage = re.sub(r'[ \t]+', ' ', passage)
        passage = passage.replace('512N356V02512N356V02', '512N356V02').replace(': :50', ': 50')
        if sid == 'JUSP-eligibility':
            a, b = passage.index('ii. Minimum Age'), passage.index('iii. Maximum Age')
            passage = passage[:a] + '''ii. Minimum Age at Entry (Completed), by Guaranteed Addition Period:
Guaranteed Addition Period (years) | Minimum Age at Entry (completed)
7 | 10 years
8 | 9 years
9 | 8 years
10 | 7 years
11 | 6 years
12 | 5 years
13 | 4 years
14 | 3 years
15 | 2 years
16 | 1 year
17 | 30 days
Reading note checked against this table: a 30-day-old child can use the 17-year period, NOT the 7-year period. The 7-year period requires at least 10 completed years of age. Delayed risk commencement for children under 8 does not waive this entry condition.
''' + passage[b:]
        passage = re.sub(r'\n{3,}', '\n\n', passage).strip()
        output.append(f'## {sid} — {label}\n\n{passage}\n')
        manifest.append(dict(id=sid, planId=plan, documentTitle=title + ' — official sales brochure', pageOrSection=f'PDF pages {", ".join(map(str, nums))}; {label}', url=DOCS[plan] + '#page=' + str(nums[0])))
    (root / 'content' / (plan + '.md')).write_text('\n'.join(output), encoding='utf-8')

(root / 'content').mkdir(exist_ok=True)
build('new-jeevan-anand', "LIC’s New Jeevan Anand • 715 • 512N279V03", [
 ('NJA-overview','Overview and eligibility',[2],None,None),
 ('NJA-benefits','Death, maturity and participation in profits',[3,4],None,'3. Options Available'),
 ('NJA-premiums','Payment frequency and grace period',[9],'4. Payment of Premiums','6. Sample'),
 ('NJA-surrender','When surrender value is acquired',[11],'10. Surrender','Guaranteed Surrender value payable'),
 ('NJA-loans','Policy loans, deductions and foreclosure',[16,17],'11.  Policy Loan','12. Forfeiture'),
 ('NJA-freelook','Free look cancellation',[18],'15. Free Look Period','16. Exclusion'),
 ('NJA-exclusion','Suicide exclusion and qualifications',[18,19],'16. Exclusion','17. '),
], 'Personal quotations, current bonus rates, future returns, current loan interest rates, tax advice, rider details, individual claim decisions and claim submission procedure are not covered. No surrender amount or refund calculation is supported. Historic loan rates are not current rates.')
build('digi-term', 'LIC’s Digi Term • 876 • 512N356V02', [
 ('DT-overview','Overview and entry eligibility',[2],None,None),
 ('DT-terms','Sum assured and payment terms',[3],None,'ii) Under Increasing'),
 ('DT-benefits','Death benefit options and no maturity benefit',[5,6],None,'4. '),
 ('DT-exit','Paid-up, surrender and loans',[12],'10. PAID-UP',None),
 ('DT-freelook','Free look cancellation',[14],'16. FREE LOOK','17. SUICIDE'),
 ('DT-exclusion','Suicide exclusion by payment type',[14],'17. SUICIDE','18. GRIEVANCE'),
], 'Increasing Sum Assured maximum-term age/band table is deliberately omitted: do not infer the maximum term for that option. Personalized quotations, current tax rates, claim submission procedure, individual underwriting and claim decisions, and Unexpired Risk Premium Value calculations are not covered. This edition is V02 despite the old listing URL.')
build('jeevan-utsav-single-premium', 'LIC’s Jeevan Utsav Single Premium • 883 • 512N392V01', [
 ('JUSP-overview','Overview and key features',[2],None,None),
 ('JUSP-eligibility','Eligibility and risk commencement',[3,4],'2. ELIGIBILITY','3. BENEFITS'),
 ('JUSP-benefits','Death, income, maturity and guaranteed additions',[4,5,6],'3. BENEFITS',None),
 ('JUSP-exit','Surrender value and policy termination',[12,13],'7.  SURRENDER',None),
 ('JUSP-loans','Policy loans and qualifications',[14,15],'8.  POLICY LOAN','9. TAXES'),
 ('JUSP-freelook','Free look cancellation',[16],'10. FREE LOOK','11. SUICIDE'),
 ('JUSP-exclusion','Suicide exclusion and age exception',[16],'11. SUICIDE','12. FORFEITURE'),
], 'Personal premium quotations, current loan interest rates, individual claim decisions, claim submission procedure, tax advice and rider details are not covered. No surrender or refund calculator. The historic 2025–26 loan rate is not a current quote. Income is a percentage of Basic Sum Assured, not a return on premium.')
(root / 'content/sources.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Wrote three knowledge files and {len(manifest)} sources.')
