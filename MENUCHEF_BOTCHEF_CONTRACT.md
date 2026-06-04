# Contrato de Integração MenuChef ↔ BotChef

**Versão:** 1.1  
**Data:** 2026-05-21  
**Status:** Proposto  
**Audiência:** Time de engenharia do MenuChef

---

## Visão geral

O BotChef é uma plataforma de automação de atendimento via WhatsApp. Quando um restaurante conecta o WhatsApp no BotChef, ele recebe um token de instância (`instanceToken`). O MenuChef precisa armazenar esse token e usá-lo para notificar o BotChef sempre que um pedido muda de status — o BotChef então dispara a mensagem WhatsApp correspondente para o cliente.

### Fluxo completo

```
[Admin BotChef] cadastra cliente com suffix do restaurante
        ↓
[Cliente] conecta WhatsApp no BotChef → gera instanceToken
        ↓
[BotChef] → POST /integrations/botchef/register → [MenuChef]
           body: { suffix, token }
        ↓
[MenuChef] salva botchef_token no restaurante
        ↓
[Pedido muda de status no MenuChef]
        ↓
[MenuChef] → POST /webhooks/menuchef → [BotChef]
           header: x-instance-token: <botchef_token>
           body: { orderId, orderNumber, status, phone, customerName, suffix }
        ↓
[BotChef] envia mensagem WhatsApp para o cliente do pedido
```

---

## 1. Alteração no banco de dados

Adicionar coluna `botchef_token` na entidade que representa o restaurante/estabelecimento.

### Entidade TypeORM

```typescript
import { Column, Entity } from 'typeorm'

@Entity()
export class Restaurant {
  // ... campos existentes ...

  @Column({ name: 'botchef_token', type: 'varchar', length: 512, nullable: true })
  botchefToken: string | null
}
```

### Migration TypeORM

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBotchefTokenToRestaurant1715000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurant"
      ADD COLUMN "botchef_token" varchar(512) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "restaurant"
      DROP COLUMN "botchef_token"
    `)
  }
}
```

> Ajuste o nome da tabela (`"restaurant"`) para o nome real na sua base.  
> O campo é nullable — restaurantes sem BotChef ficam com `NULL`.

---

## 2. Novo endpoint: registro do token

O BotChef chama este endpoint quando o restaurante conecta (ou reconecta) o WhatsApp.

### Especificação

```
POST /integrations/botchef/register
```

**Autenticação:** segredo compartilhado no header.

```
x-botchef-secret: <BOTCHEF_SECRET>
```

`BOTCHEF_SECRET` é uma variável de ambiente configurada no MenuChef com o mesmo valor que `MENUCHEF_BOTCHEF_SECRET` no BotChef. Mínimo 32 caracteres. **Validar em toda requisição antes de qualquer acesso ao banco.**

**Body da requisição:**

```json
{
  "suffix": "minha-pizzaria",
  "token": "ey..."
}
```

| Campo    | Tipo   | Obrigatório | Descrição                                                 |
|----------|--------|-------------|-----------------------------------------------------------|
| `suffix` | string | Sim         | Slug único do restaurante. Deve existir no banco.         |
| `token`  | string | Sim         | Token de instância BotChef. Salvar como `botchef_token`.  |

**Respostas:**

| Status | Quando                                    | Body                                |
|--------|-------------------------------------------|-------------------------------------|
| 200    | Sucesso                                   | `{ "ok": true }`                    |
| 400    | Campos ausentes ou inválidos              | `{ "error": "Invalid request body" }`|
| 401    | `x-botchef-secret` ausente ou incorreto  | `{ "error": "Unauthorized" }`       |
| 404    | Suffix não encontrado                     | `{ "error": "Restaurant not found" }`|
| 500    | Erro interno                              | `{ "error": "Internal server error" }`|

### Implementação NestJS (referência)

**Controller:**

```typescript
@Controller('integrations/botchef')
export class BotchefIntegrationController {
  constructor(private readonly service: BotchefIntegrationService) {}

  @Post('register')
  async register(
    @Headers('x-botchef-secret') secret: string,
    @Body() dto: RegisterBotchefTokenDto,
  ) {
    if (!secret || secret !== process.env.BOTCHEF_SECRET) {
      throw new UnauthorizedException()
    }
    await this.service.registerToken(dto.suffix, dto.token)
    return { ok: true }
  }
}
```

**DTO:**

```typescript
import { IsString, IsNotEmpty, MaxLength } from 'class-validator'

export class RegisterBotchefTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  suffix: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string
}
```

**Service:**

```typescript
@Injectable()
export class BotchefIntegrationService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
  ) {}

  async registerToken(suffix: string, token: string): Promise<void> {
    const restaurant = await this.restaurantRepo.findOne({ where: { suffix } })
    if (!restaurant) throw new NotFoundException('Restaurant not found')

    restaurant.botchefToken = token
    await this.restaurantRepo.save(restaurant)
  }
}
```

> O endpoint é **idempotente**: chamadas repetidas com o mesmo token apenas sobrescrevem o valor — comportamento correto para reconexões.

---

## 3. Envio do webhook de status de pedido

Quando um pedido muda de status, o MenuChef deve notificar o BotChef.

### Especificação

```
POST https://<BOTCHEF_API_URL>/webhooks/menuchef
```

**Headers obrigatórios:**

```
Content-Type: application/json
x-instance-token: <restaurant.botchef_token>
```

**Body:**

```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "orderNumber": "1042",
  "status": "order_confirmed",
  "phone": "+5511999999999",
  "customerName": "João Silva",
  "suffix": "minha-pizzaria"
}
```

| Campo          | Tipo   | Obrigatório         | Descrição                                                              |
|----------------|--------|---------------------|------------------------------------------------------------------------|
| `orderId`      | string | Sim                 | Identificador interno do pedido (UUID).                                |
| `orderNumber`  | string | Recomendado         | Número sequencial visível ao cliente (ex: `"1042"`). Sem o `#`. Se ausente, o BotChef usa `orderId` como fallback. |
| `status`       | string | Sim                 | Status do pedido. Ver tabela de valores válidos abaixo.                |
| `phone`        | string | Sim                 | Telefone do cliente em formato E.164 (`+5511999999999`).               |
| `customerName` | string | Não                 | Nome do cliente para interpolação no template (`{{nome}}`).            |
| `suffix`       | string | Recomendado         | Slug do restaurante. Usado para validação dupla de segurança no BotChef. |

> **Enviar apenas quando `botchef_token IS NOT NULL`.** Restaurantes sem token não têm BotChef configurado.

> **O nome do restaurante (`{{restaurante}}`) não precisa ser enviado pelo MenuChef** — o BotChef busca diretamente do seu próprio banco de dados pelo token da instância.

### Valores válidos para `status`

| Valor                | Descrição                                         |
|----------------------|---------------------------------------------------|
| `order_confirmed`    | Pedido confirmado pelo restaurante                |
| `order_preparing`    | Pedido em preparo na cozinha                      |
| `order_ready`        | Pedido pronto para retirada no balcão (cliente busca) |
| `order_delivering`   | Pedido saiu para entrega (delivery / motoboy)     |
| `order_delivered`    | Pedido entregue ao cliente                        |
| `order_cancelled`    | Pedido cancelado                                  |

> **Atenção:** `order_ready` (pronto para retirada no balcão) é diferente de `order_delivering` (saiu para entrega). Usar o valor correto garante que o cliente receba a mensagem adequada para cada modalidade.

### Variáveis disponíveis nos templates BotChef

| Variável           | Origem                          | Descrição                     |
|--------------------|---------------------------------|-------------------------------|
| `{{nome}}`         | Campo `customerName` do payload | Nome do cliente               |
| `{{pedido}}`       | Campo `orderNumber` (ou `orderId`) | Número do pedido           |
| `{{status}}`       | Campo `status` do payload       | Status bruto recebido         |
| `{{telefone}}`     | Campo `phone` do payload        | Telefone do cliente           |
| `{{restaurante}}`  | Banco do BotChef (`user.name`)  | Nome do restaurante (automático) |

**Respostas esperadas do BotChef:**

| Status | Significado                                                   | Ação recomendada                        |
|--------|---------------------------------------------------------------|-----------------------------------------|
| 200    | Mensagem enviada ao cliente (ou status ignorado sem template) | Nenhuma                                 |
| 400    | Payload inválido                                              | Não retentar — corrigir payload         |
| 401    | Token inválido ou suffix não coincide                         | Limpar `botchef_token` e não retentar   |
| 5xx    | Erro no servidor BotChef                                      | Retentar com backoff (máx. 3 tentativas)|

**Lógica de retry sugerida:**

```typescript
const delays = [1000, 2000, 4000]

for (let attempt = 0; attempt <= delays.length; attempt++) {
  const res = await fetch(...)
  if (res.ok || res.status < 500) break
  if (attempt < delays.length) await sleep(delays[attempt])
}
```

### Implementação NestJS (referência)

```typescript
@Injectable()
export class BotchefNotificationService {
  private readonly logger = new Logger(BotchefNotificationService.name)
  private readonly botchefUrl = process.env.BOTCHEF_API_URL

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
  ) {}

  async notifyOrderStatus(restaurant: Restaurant, orderId: string, orderNumber: string | undefined, status: string, phone: string, customerName?: string): Promise<void> {
    if (!restaurant.botchefToken) return

    try {
      const response = await fetch(`${this.botchefUrl}/webhooks/menuchef`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-instance-token': restaurant.botchefToken,
        },
        body: JSON.stringify({
          orderId,
          orderNumber,   // número sequencial visível ao cliente (ex: "1042")
          status,
          phone,
          customerName,
          suffix: restaurant.suffix,
        }),
      })

      if (response.status === 401) {
        // Token inválido — limpa para evitar chamadas futuras com 401
        restaurant.botchefToken = null
        await this.restaurantRepo.save(restaurant)
        this.logger.warn(`BotChef token inválido para restaurante ${restaurant.suffix} — campo limpo`)
      }
    } catch (err) {
      // Notificação é não-crítica — logar e continuar
      this.logger.error('Falha ao notificar BotChef', { orderId, error: err })
    }
  }
}
```

---

## 4. Variáveis de ambiente necessárias no MenuChef

```env
# Segredo compartilhado com o BotChef — deve ser idêntico ao MENUCHEF_BOTCHEF_SECRET no BotChef
BOTCHEF_SECRET=troque-por-segredo-compartilhado-minimo-32-chars

# URL base da API do BotChef
BOTCHEF_API_URL=https://api.botchef.com
```

---

## 5. Tratamento de casos de borda

| Cenário | Comportamento esperado |
|---|---|
| Restaurante sem `botchef_token` | Não enviar webhook de status |
| BotChef retorna 401 | Limpar `botchef_token`; BotChef re-registrará na próxima conexão WhatsApp |
| BotChef retorna 5xx | Retentar até 3 vezes com backoff exponencial (1s / 2s / 4s) |
| Suffix não existe no MenuChef | Retornar 404 no endpoint de registro; BotChef logará o erro |
| Reconexão WhatsApp (mesmo token) | Chamada ao registro é idempotente — sem efeito colateral |
| `x-botchef-secret` incorreto | Retornar 401 imediatamente, sem acesso ao banco |

---

## 6. Checklist de implementação

- [ ] Adicionar coluna `botchef_token` na entidade `Restaurant`
- [ ] Criar e rodar a migration
- [ ] Configurar variáveis de ambiente `BOTCHEF_SECRET` e `BOTCHEF_API_URL`
- [ ] Implementar `BotchefIntegrationModule` (controller + service + DTO)
- [ ] Implementar `BotchefNotificationService` e injetar no handler de mudança de status
- [ ] Incluir `orderNumber` (número sequencial do pedido) no payload do webhook
- [ ] Testar endpoint de registro com um sufixo válido e inválido
- [ ] Testar envio de webhook de status e verificar mensagem no WhatsApp
- [ ] Verificar comportamento com token inválido (401 → limpeza do campo)

---

## 7. Checklist de verificação end-to-end

1. Admin BotChef cadastra cliente com suffix `minha-pizzaria`
2. Cliente escaneia QR → BotChef chama `POST /integrations/botchef/register` com `{ suffix: "minha-pizzaria", token: "ey..." }` → `botchef_token` salvo no MenuChef
3. Pedido `ORD-001` vai para status `confirmed` no MenuChef → MenuChef chama `POST /webhooks/menuchef` → cliente recebe mensagem WhatsApp
4. Suffix divergente enviado no webhook → BotChef retorna 401 + log de warning
5. Token desatualizado → BotChef retorna 401 → MenuChef limpa `botchef_token` → após próxima conexão WhatsApp o campo é restaurado

---

## 8. Evento de pedido criado (`order_created`)

Além das notificações de mudança de status, o BotChef suporta uma notificação especial enviada assim que o pedido é **realizado pelo cliente** — antes de qualquer mudança de status. Essa mensagem contém um resumo completo do pedido, endereço de entrega e informações de pagamento.

### Quando disparar

Chamar `POST /webhooks/menuchef` com `status: "order_created"` imediatamente após o pedido ser criado/registrado no MenuChef (equivalente ao evento de "novo pedido recebido").

### Body do evento `order_created`

```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "orderNumber": "7667603",
  "status": "order_created",
  "phone": "+5518999999999",
  "customerName": "Marcelo",
  "suffix": "minha-pizzaria",
  "deliveryStreet": "Rua Carmine Ferrari, 200",
  "deliveryReference": "Diego Alves",
  "deliveryNeighborhood": "Conjunto Habitacional Promorar",
  "deliveryCity": "Osvaldo Cruz",
  "orderDate": "31/03/2026 20:56:26",
  "deliveryFee": "R$ 6.00",
  "estimatedDelivery": "entre 21:36 e 21:56",
  "items": "> 2: MI TÓRA NA BATATA\n\n_Adicionais:_\n1 x não quero maionese de bacon",
  "paymentMethod": "Cartão MasterCard - Débito",
  "paymentNote": "O pagamento será realizado na entrega",
  "total": "R$58.00"
}
```

### Campos adicionais do payload `order_created`

Todos os campos abaixo são opcionais. Se ausentes, o template renderizará strings vazias naquelas posições.

| Campo                  | Tipo   | Descrição                                                                  |
|------------------------|--------|----------------------------------------------------------------------------|
| `deliveryStreet`       | string | Rua e número do endereço de entrega                                        |
| `deliveryReference`    | string | Ponto de referência do endereço                                            |
| `deliveryNeighborhood` | string | Bairro de entrega                                                          |
| `deliveryCity`         | string | Cidade de entrega                                                          |
| `orderDate`            | string | Data e hora do pedido formatada (ex: `"31/03/2026 20:56:26"`)              |
| `deliveryFee`          | string | Taxa de entrega formatada (ex: `"R$ 6.00"`)                               |
| `estimatedDelivery`    | string | Previsão de entrega formatada (ex: `"entre 21:36 e 21:56"`)               |
| `items`                | string | Itens do pedido **pré-formatados** pelo MenuChef (ver formato abaixo)     |
| `paymentMethod`        | string | Forma de pagamento (ex: `"Cartão MasterCard - Débito"`)                   |
| `paymentNote`          | string | Observação sobre pagamento (ex: `"O pagamento será realizado na entrega"`) |
| `total`                | string | Valor total formatado (ex: `"R$58.00"`)                                   |

#### Formato do campo `items`

O MenuChef deve montar a string de itens. Cada item segue o padrão:

```
> {quantidade}: {nome do item}

_Adicionais:_
{quantidade} x {nome do adicional}
```

Múltiplos itens são separados por linha em branco. Exemplo com dois itens:

```
> 2: MI TÓRA NA BATATA

_Adicionais:_
1 x não quero maionese de bacon

> 1: HAMBÚRGUER CLÁSSICO
```

### Novas variáveis disponíveis nos templates BotChef

Além das variáveis já documentadas na Seção 3, o evento `order_created` disponibiliza:

| Variável               | Origem                             | Descrição                        |
|------------------------|------------------------------------|----------------------------------|
| `{{rua}}`              | `deliveryStreet`                   | Rua e número de entrega          |
| `{{ponto_ref}}`        | `deliveryReference`                | Ponto de referência              |
| `{{bairro}}`           | `deliveryNeighborhood`             | Bairro de entrega                |
| `{{cidade}}`           | `deliveryCity`                     | Cidade de entrega                |
| `{{data_pedido}}`      | `orderDate`                        | Data e hora do pedido            |
| `{{taxa_entrega}}`     | `deliveryFee`                      | Taxa de entrega                  |
| `{{previsao_entrega}}` | `estimatedDelivery`                | Previsão de entrega              |
| `{{itens}}`            | `items`                            | Bloco de itens pré-formatado     |
| `{{forma_pagamento}}`  | `paymentMethod`                    | Forma de pagamento               |
| `{{info_pagamento}}`   | `paymentNote`                      | Observação de pagamento          |
| `{{total}}`            | `total`                            | Valor total do pedido            |

> As variáveis `{{nome}}`, `{{pedido}}`, `{{telefone}}` e `{{restaurante}}` também estão disponíveis e funcionam da mesma forma que nas notificações de status.

### Template padrão gerado pelo BotChef

Quando o restaurante não configurar um template customizado para `order_created`, o BotChef enviará:

```
🎉 *Olá, {{nome}}! Seu pedido foi realizado com sucesso!*
Você será notificado sobre o andamento por aqui. 😊

📍 *Endereço de Entrega:*
- Rua: {{rua}}
- Ponto de Ref.: {{ponto_ref}}
- Bairro: {{bairro}}
- Cidade: {{cidade}}

🗒️ *Resumo do Pedido:*
- Código: {{pedido}}
- Nome: {{nome}}
- Data do Pedido: {{data_pedido}}
- Taxa de Entrega: {{taxa_entrega}}
- Previsão de Entrega: {{previsao_entrega}}

🛒 *Itens do Pedido:*
{{itens}}

💰 *Forma de Pagamento:* {{forma_pagamento}}
*{{info_pagamento}}*

✅ *Total:* {{total}}
```

### Implementação NestJS (referência)

```typescript
@Injectable()
export class BotchefNotificationService {
  // ... (construtor e logger como na Seção 3)

  async notifyOrderCreated(restaurant: Restaurant, order: Order): Promise<void> {
    if (!restaurant.botchefToken) return

    const items = order.items
      .map((item) => {
        let block = `> ${item.quantity}: ${item.name}`
        if (item.additionals?.length) {
          block += `\n\n_Adicionais:_\n${item.additionals.map((a) => `${a.quantity} x ${a.name}`).join('\n')}`
        }
        return block
      })
      .join('\n\n')

    try {
      await fetch(`${this.botchefUrl}/webhooks/menuchef`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-instance-token': restaurant.botchefToken,
        },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: String(order.number),
          status: 'order_created',
          phone: order.customer.phone,
          customerName: order.customer.name,
          suffix: restaurant.suffix,
          deliveryStreet: order.address?.street,
          deliveryReference: order.address?.reference,
          deliveryNeighborhood: order.address?.neighborhood,
          deliveryCity: order.address?.city,
          orderDate: format(order.createdAt, 'dd/MM/yyyy HH:mm:ss'),
          deliveryFee: formatCurrency(order.deliveryFee),
          estimatedDelivery: order.estimatedDelivery,
          items,
          paymentMethod: order.payment.method,
          paymentNote: order.payment.note,
          total: formatCurrency(order.total),
        }),
      })
    } catch (err) {
      this.logger.error('Falha ao notificar BotChef (order_created)', { orderId: order.id, error: err })
    }
  }
}
```

### Checklist de implementação (MenuChef)

- [ ] Adicionar `order_created` ao `BotchefNotificationService`
- [ ] Chamar `notifyOrderCreated` no handler de criação de pedido (após persistir no banco)
- [ ] Formatar o campo `items` conforme o padrão documentado acima
- [ ] Garantir que `botchef_token IS NOT NULL` antes de chamar (mesmo guard já existente)
