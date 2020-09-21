export interface TicketsResponse {
	ok: boolean;
	msg: string;
	tickets: ITicket[];
}

export interface TicketResponse {
	ok: boolean;
	msg: string;
	ticket: ITicket | null;
}

export interface ITicket {
	id_ticket: number;
	id_socket: string;
	id_socket_desk: string | null;
	id_desk: number | null;
	id_company: string;
	tm_start: number;
	tm_att: number | null;
	tm_end: number | null;
}

