import re,sys
src=open('docs/schema.prisma').read()
enums={m.group(1):[v.strip() for v in m.group(2).split('\n') if v.strip()] for m in re.finditer(r'enum (\w+) \{\n(.*?)\n\}',src,re.S)}
models={}
order=[]
for m in re.finditer(r'model (\w+) \{\n(.*?)\n\}',src,re.S):
    models[m.group(1)]=m.group(2); order.append(m.group(1))
RES=set('ACCESS ADD ALL ALTER AND ANY AS ASC AUDIT BETWEEN BY CHAR CHECK CLUSTER COLUMN COMMENT COMPRESS CONNECT CREATE CURRENT DATE DECIMAL DEFAULT DELETE DESC DISTINCT DROP ELSE EXCLUSIVE EXISTS FILE FLOAT FOR FROM GRANT GROUP HAVING IDENTIFIED IMMEDIATE IN INCREMENT INDEX INITIAL INSERT INTEGER INTERSECT INTO IS LEVEL LIKE LOCK LONG MAXEXTENTS MINUS MLSLABEL MODE MODIFY NOAUDIT NOCOMPRESS NOT NOWAIT NULL NUMBER OF OFFLINE ON ONLINE OPTION OR ORDER PCTFREE PRIOR PRIVILEGES PUBLIC RAW RENAME RESOURCE REVOKE ROW ROWID ROWNUM ROWS SELECT SESSION SET SHARE SIZE SMALLINT START SUCCESSFUL SYNONYM SYSDATE TABLE THEN TO TRIGGER UID UNION UNIQUE UPDATE USER VALIDATE VALUES VARCHAR VARCHAR2 VIEW WHENEVER WHERE WITH'.split())
TREN={'User':'app_user','Role':'app_role','Session':'user_session'}
CREN={'date':'entry_date','number':'doc_number','order':'sign_order','position':'line_position'}
snake=lambda n:re.sub(r'(?<!^)(?=[A-Z])','_',n).lower()
tname=lambda m:TREN.get(m,snake(m))
cname=lambda n:CREN.get(snake(n),snake(n))
LONG=re.compile(r'notes|description|message|terms|memo|address|reason|lastError|renewalTerms',re.I)
cnt={'fk':0,'uq':0,'ix':0,'ck':0}
def nm(k,t): cnt[k]+=1; return '%s_%s_%d'%(k,t[:14],cnt[k])
tables={}
for M in order:
    cols=[];pk=None;uniq=[];fks=[];idx=[];chk=[];nullable=set();fmap={}
    for raw in models[M].split('\n'):
        line=raw.split('//')[0].strip()
        if not line: continue
        if line.startswith('@@unique'):
            uniq.append(('c',[x.strip() for x in re.search(r'\[(.*?)\]',line).group(1).split(',')]));continue
        if line.startswith('@@index'):
            idx.append([x.strip() for x in re.search(r'\[(.*?)\]',line).group(1).split(',')]);continue
        f=re.match(r'^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$',line)
        if not f: continue
        n,ty,lst,opt,at=f.groups(); at=at or ''
        if ty in models:
            r=re.search(r'@relation\((.*)\)',at)
            if r and 'fields:' in r.group(1):
                a=re.search(r'fields:\s*\[(\w+)\]',r.group(1)).group(1);b=re.search(r'references:\s*\[(\w+)\]',r.group(1)).group(1)
                od=re.search(r'onDelete:\s*(\w+)',r.group(1))
                fks.append((a,ty,b,bool(od and od.group(1)=='Cascade')))
            continue
        db=re.search(r'@db\.(\w+)(?:\(([^)]*)\))?',at)
        d=re.search(r'@default\(((?:[^()]|\([^()]*\))*)\)',at)
        c=cname(n); assert c.upper() not in RES,(M,c)
        if opt: nullable.add(n)
        notnull='' if opt else ' NOT NULL'
        default=''
        if lst: sqlt='CLOB';default=" DEFAULT '[]'";chk.append('%s IS JSON'%c);notnull=' NOT NULL'
        else:
            if ty=='String':
                if db and db.group(1)=='Uuid': sqlt='RAW(16)'
                elif db and db.group(1)=='Char': sqlt='CHAR(%s)'%db.group(2)
                else: sqlt='VARCHAR2(%d CHAR)'%(2000 if LONG.search(n) else 255)
            elif ty=='Int': sqlt='NUMBER(10)'
            elif ty=='BigInt': sqlt='NUMBER(19)'
            elif ty=='Boolean': sqlt='NUMBER(1)';chk.append('%s IN (0,1)'%c)
            elif ty=='DateTime': sqlt='DATE' if db and db.group(1)=='Date' else 'TIMESTAMP'
            elif ty=='Float': sqlt='BINARY_DOUBLE'
            elif ty=='Decimal': sqlt='NUMBER(%s)'%db.group(2).replace(' ','')
            elif ty=='Json': sqlt='CLOB';chk.append('%s IS JSON'%c)
            elif ty in enums: sqlt='VARCHAR2(40 CHAR)';chk.append("%s IN (%s)"%(c,','.join("'%s'"%v for v in enums[ty])))
            else: raise Exception((M,n,ty))
            if d:
                v=d.group(1).strip()
                if v=='uuid()': default=' DEFAULT SYS_GUID()'
                elif v=='now()': default=' DEFAULT SYSTIMESTAMP'
                elif v in('true','false'): default=' DEFAULT %d'%(v=='true')
                elif v.startswith('"'): default=" DEFAULT '%s'"%v.strip('"')
                elif re.match(r'^-?\d+(\.\d+)?$',v): default=' DEFAULT %s'%v
                elif v in enums.get(ty,[]): default=" DEFAULT '%s'"%v
                else: raise Exception((M,n,v))
            elif '@updatedAt' in at: default=' DEFAULT SYSTIMESTAMP'
        if '@id' in at: pk=c
        if re.search(r'@unique\b',at): uniq.append(('f',[n]))
        cols.append((c,sqlt+default+notnull)); fmap[n]=c
    tables[M]=dict(cols=cols,pk=pk,uniq=uniq,fks=fks,idx=idx,chk=chk,nullable=nullable,fmap=fmap)
out=['-- Rental Property Management & Accounting System: Oracle schema (for Oracle FreeSQL)','-- Generated from docs/schema.prisma. NOT yet run against a live database.','-- Notes: ids are RAW(16) (use SYS_GUID()); money is whole cents; arrays and JSON are CLOB checked IS JSON;','-- enums are VARCHAR2 with CHECK constraints. Renamed to avoid Oracle reserved words: User->app_user, Role->app_role,','-- Session->user_session, date->entry_date, number->doc_number, order->sign_order, position->line_position.','']
post_fk=[];post_idx=[]
for M in order:
    t=tables[M];T=tname(M);lines=['  %s %s'%(c,d) for c,d in t['cols']]
    lines.append('  CONSTRAINT pk_%s PRIMARY KEY (%s)'%(T[:24],t['pk']))
    for c in t['chk']:
        lines.append('  CONSTRAINT %s CHECK (%s)'%(nm('ck',T),c))
    for kind,fl in t['uniq']:
        cs=[t['fmap'][x] for x in fl]
        nl=[x for x in fl if x in t['nullable']]
        if nl and len(fl)>1:
            nn=[t['fmap'][x] for x in nl]
            cond=' AND '.join('%s IS NOT NULL'%x for x in nn)
            exprs=[('CASE WHEN %s THEN %s END'%(cond,t['fmap'][x]) if x not in t['nullable'] else t['fmap'][x]) for x in fl]
            post_idx.append('CREATE UNIQUE INDEX %s ON %s (%s);'%(nm('uq',T),T,', '.join(exprs)))
        else:
            lines.append('  CONSTRAINT %s UNIQUE (%s)'%(nm('uq',T),', '.join(cs)))
    out.append('CREATE TABLE %s (\n%s\n);\n'%(T,',\n'.join(lines)))
    for a,ty,b,cas in t['fks']:
        post_fk.append('ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s (%s)%s;'%(T,nm('fk',T),t['fmap'][a],tname(ty),tables[ty]['fmap'][b],' ON DELETE CASCADE' if cas else ''))
    for fl in t['idx']:
        post_idx.append('CREATE INDEX %s ON %s (%s);'%(nm('ix',T),T,', '.join(t['fmap'][x] for x in fl)))
jel=tname('JournalEntryLine')
out+=['-- Foreign keys','']+post_fk+['','-- Indexes (including unique indexes that tolerate NULLs the way PostgreSQL does)','']+post_idx
out+=['','-- Business rule: a ledger line is either a debit or a credit, never both','ALTER TABLE %s ADD CONSTRAINT ck_jel_one_side CHECK ((debit_cents > 0 AND credit_cents = 0) OR (credit_cents > 0 AND debit_cents = 0));'%jel,'',
'-- Not included yet (need triggers): balanced journal entries, immutable posted entries and signed documents,','-- append-only audit and signature logs, one active lease per unit.','']
sql='\n'.join(out)
open('database/schema_oracle.sql','w').write(sql)
drop=['-- Removes every table created by schema_oracle.sql (data is lost).']+['DROP TABLE %s CASCADE CONSTRAINTS PURGE;'%tname(M) for M in reversed(order)]
open('database/drop_all_oracle.sql','w').write('\n'.join(drop)+'\n')
allnames=[tname(M) for M in order]+[c for M in order for c,_ in tables[M]['cols']]
print('tables',len(order),'fks',len(post_fk),'idx',len(post_idx),'maxlen',max(len(x) for x in allnames))
mx=[l for l in sql.split('\n') if re.search(r'CONSTRAINT (\w+)',l) and len(re.search(r'CONSTRAINT (\w+)',l).group(1))>30]
print('constraint names >30:',len(mx))
print(sql[sql.index('CREATE TABLE journal_entry_line'):sql.index('CREATE TABLE journal_entry_line')+1100])
